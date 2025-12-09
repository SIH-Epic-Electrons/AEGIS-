import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';

interface FloatingActionMenuProps {
  actions?: Array<{ icon: string; label: string; onPress: () => void }>;
  alerts?: any[];
  selectedAlert?: any;
  visible?: boolean;
  onDeployTeam?: () => Promise<void>;
  onActivateCordon?: () => Promise<void>;
  onViewMap?: () => void;
  onQuickReport?: () => void;
  onVoiceNote?: () => void;
  onCamera?: () => void;
}

export default function FloatingActionMenu({ 
  actions = [], 
  alerts,
  selectedAlert,
  visible = true,
  onDeployTeam,
  onActivateCordon,
  onViewMap,
  onQuickReport,
  onVoiceNote,
  onCamera,
}: FloatingActionMenuProps) {
  const { theme } = useTheme();

  if (!visible || actions.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Placeholder for floating action menu */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 28,
    padding: 12,
  },
});

