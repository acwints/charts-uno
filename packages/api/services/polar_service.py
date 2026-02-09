"""
Polar.sh Integration Service for Chartsuno SaaS

Handles subscription management, checkout sessions, and customer portal access.
"""
import os
import hmac
import hashlib
import base64
import time
from typing import Optional
from datetime import datetime

import httpx

# Polar API configuration
POLAR_API_URL = "https://api.polar.sh/v1"
POLAR_ACCESS_TOKEN = os.environ.get("POLAR_ACCESS_TOKEN")
POLAR_WEBHOOK_SECRET = os.environ.get("POLAR_WEBHOOK_SECRET")
POLAR_ORGANIZATION_ID = os.environ.get("POLAR_ORGANIZATION_ID")

# Product IDs for each plan
POLAR_PRODUCT_PRO = os.environ.get("POLAR_PRODUCT_PRO")
POLAR_PRODUCT_BUSINESS = os.environ.get("POLAR_PRODUCT_BUSINESS")

# Plan configurations
PLAN_CONFIG = {
    "free": {
        "seat_limit": 1,
        "charts_per_month": 10,
        "price": 0,
    },
    "pro": {
        "seat_limit": 5,
        "charts_per_month": -1,  # unlimited
        "price": 15,
        "product_id": POLAR_PRODUCT_PRO,
    },
    "business": {
        "seat_limit": -1,  # unlimited
        "charts_per_month": -1,  # unlimited
        "price": 49,
        "product_id": POLAR_PRODUCT_BUSINESS,
    },
}


class PolarServiceError(Exception):
    """Custom exception for Polar service errors"""
    pass


class PolarService:
    """Service for interacting with Polar.sh API"""

    def __init__(self):
        self.api_url = POLAR_API_URL
        self.access_token = POLAR_ACCESS_TOKEN
        self.organization_id = POLAR_ORGANIZATION_ID

    def _get_headers(self) -> dict:
        """Get authorization headers for Polar API requests"""
        if not self.access_token:
            raise PolarServiceError("POLAR_ACCESS_TOKEN not configured")
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    async def create_checkout_session(
        self,
        team_id: str,
        plan: str,
        customer_email: str,
        success_url: str,
        cancel_url: Optional[str] = None,
    ) -> dict:
        """
        Create a Polar checkout session for upgrading to a paid plan.

        Args:
            team_id: The team ID to associate with the subscription
            plan: The plan to subscribe to ("pro" or "business")
            customer_email: Customer's email for the checkout
            success_url: URL to redirect to on successful checkout
            cancel_url: URL to redirect to on cancelled checkout

        Returns:
            dict with checkout_url for redirecting the user
        """
        if plan not in ["pro", "business"]:
            raise PolarServiceError(f"Invalid plan: {plan}. Must be 'pro' or 'business'")

        product_id = PLAN_CONFIG[plan].get("product_id")
        if not product_id:
            raise PolarServiceError(f"Product ID not configured for plan: {plan}")

        payload = {
            "product_id": product_id,
            "success_url": success_url,
            "customer_email": customer_email,
            "metadata": {
                "team_id": team_id,
                "plan": plan,
            },
        }

        if cancel_url:
            payload["cancel_url"] = cancel_url

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/checkouts/custom",
                headers=self._get_headers(),
                json=payload,
                timeout=30.0,
            )

            if response.status_code != 201:
                raise PolarServiceError(
                    f"Failed to create checkout session: {response.status_code} - {response.text}"
                )

            data = response.json()
            return {
                "checkout_id": data.get("id"),
                "checkout_url": data.get("url"),
            }

    async def create_customer_portal_url(
        self,
        polar_customer_id: str,
    ) -> str:
        """
        Create a customer portal URL for managing subscriptions.

        Args:
            polar_customer_id: The Polar customer ID

        Returns:
            Portal URL string
        """
        if not polar_customer_id:
            raise PolarServiceError("No Polar customer ID provided")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/customer-sessions",
                headers=self._get_headers(),
                json={"customer_id": polar_customer_id},
                timeout=30.0,
            )

            if response.status_code != 201:
                raise PolarServiceError(
                    f"Failed to create customer portal: {response.status_code} - {response.text}"
                )

            data = response.json()
            return data.get("customer_portal_url")

    async def get_subscription(self, polar_subscription_id: str) -> Optional[dict]:
        """
        Get subscription details from Polar.

        Args:
            polar_subscription_id: The Polar subscription ID

        Returns:
            Subscription data dict or None if not found
        """
        if not polar_subscription_id:
            return None

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/subscriptions/{polar_subscription_id}",
                headers=self._get_headers(),
                timeout=30.0,
            )

            if response.status_code == 404:
                return None

            if response.status_code != 200:
                raise PolarServiceError(
                    f"Failed to get subscription: {response.status_code} - {response.text}"
                )

            return response.json()

    async def cancel_subscription(self, polar_subscription_id: str) -> bool:
        """
        Cancel a subscription (will remain active until period end).

        Args:
            polar_subscription_id: The Polar subscription ID

        Returns:
            True if cancelled successfully
        """
        if not polar_subscription_id:
            raise PolarServiceError("No subscription ID provided")

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.api_url}/subscriptions/{polar_subscription_id}",
                headers=self._get_headers(),
                timeout=30.0,
            )

            if response.status_code not in [200, 204]:
                raise PolarServiceError(
                    f"Failed to cancel subscription: {response.status_code} - {response.text}"
                )

            return True

    @staticmethod
    def verify_webhook_signature(
        payload: bytes,
        signature: str,
        msg_id: str,
        timestamp: str,
    ) -> bool:
        """
        Verify the webhook signature from Polar using Standard Webhooks format.

        Polar uses the Standard Webhooks specification:
        - Signs: "{msg_id}.{timestamp}.{body}"
        - Secret is base64-encoded with optional "whsec_" prefix
        - Signature header format: "v1,{base64_hmac_sha256}"

        Args:
            payload: Raw request body bytes
            signature: Signature from webhook-signature header
            msg_id: Value from webhook-id header
            timestamp: Value from webhook-timestamp header

        Returns:
            True if signature is valid
        """
        if not POLAR_WEBHOOK_SECRET:
            raise PolarServiceError("POLAR_WEBHOOK_SECRET not configured")

        if not msg_id or not timestamp:
            return False

        # Validate timestamp to prevent replay attacks (5 min tolerance)
        try:
            ts = int(timestamp)
            now = int(time.time())
            if abs(now - ts) > 300:
                return False
        except (ValueError, TypeError):
            return False

        # Decode the secret (Standard Webhooks uses base64 with optional "whsec_" prefix)
        secret = POLAR_WEBHOOK_SECRET
        if secret.startswith("whsec_"):
            secret = secret[6:]
        try:
            secret_bytes = base64.b64decode(secret)
        except Exception:
            # Fallback: treat as raw UTF-8 secret if not base64-encoded
            secret_bytes = secret.encode()

        # Construct the signed content: "{msg_id}.{timestamp}.{body}"
        to_sign = f"{msg_id}.{timestamp}.".encode() + payload

        expected = hmac.new(
            secret_bytes,
            to_sign,
            hashlib.sha256,
        ).digest()
        expected_b64 = base64.b64encode(expected).decode()

        # Signature header may contain multiple space-separated versioned signatures
        for sig in signature.split(" "):
            parts = sig.split(",", 1)
            if len(parts) == 2 and parts[0] == "v1":
                if hmac.compare_digest(expected_b64, parts[1]):
                    return True

        return False

    @staticmethod
    def get_plan_config(plan: str) -> dict:
        """Get configuration for a plan"""
        return PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])

    @staticmethod
    def parse_webhook_event(event_type: str, data: dict) -> dict:
        """
        Parse a Polar webhook event into a standardized format.

        Args:
            event_type: The event type (e.g., "subscription.created")
            data: The event data payload

        Returns:
            Parsed event data with relevant fields
        """
        result = {
            "event_type": event_type,
            "raw_data": data,
        }

        if event_type.startswith("subscription."):
            subscription = data.get("data", {})
            result.update({
                "polar_subscription_id": subscription.get("id"),
                "polar_customer_id": subscription.get("customer_id"),
                "status": subscription.get("status"),
                "current_period_start": subscription.get("current_period_start"),
                "current_period_end": subscription.get("current_period_end"),
                "metadata": subscription.get("metadata", {}),
            })

            # Try to extract team_id from metadata
            result["team_id"] = result["metadata"].get("team_id")
            result["plan"] = result["metadata"].get("plan")

        elif event_type == "checkout.completed":
            checkout = data.get("data", {})
            result.update({
                "checkout_id": checkout.get("id"),
                "polar_subscription_id": checkout.get("subscription_id"),
                "polar_customer_id": checkout.get("customer_id"),
                "customer_email": checkout.get("customer_email"),
                "metadata": checkout.get("metadata", {}),
            })

            result["team_id"] = result["metadata"].get("team_id")
            result["plan"] = result["metadata"].get("plan")

            # Extract subscription period dates if present in checkout data
            subscription_data = checkout.get("subscription", {}) or {}
            result["current_period_start"] = subscription_data.get("current_period_start")
            result["current_period_end"] = subscription_data.get("current_period_end")

        return result


# Singleton instance
polar_service = PolarService()
