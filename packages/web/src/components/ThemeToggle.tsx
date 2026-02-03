import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="theme-toggle-track">
        <motion.div
          className="theme-toggle-thumb"
          animate={{ x: theme === 'dark' ? 0 : 28 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
        <Sun className="theme-icon theme-icon--sun" size={13} />
        <Moon className="theme-icon theme-icon--moon" size={13} />
      </div>
    </motion.button>
  );
}
