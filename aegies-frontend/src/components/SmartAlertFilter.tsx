import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/theme';

interface SmartAlertFilterProps {
  filters?: string[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  setFilter?: (filter: string) => void; // Alias for onFilterChange
  alerts?: any[]; // Accept but ignore
  userLocation?: any; // Accept but ignore
  currentOfficerId?: string; // Accept but ignore
}

export default function SmartAlertFilter({ 
  filters = ['All', 'Critical', 'High', 'Medium'], 
  activeFilter, 
  onFilterChange,
  setFilter,
  alerts,
  userLocation,
  currentOfficerId,
}: SmartAlertFilterProps) {
  const handleFilterChange = (filter: string) => {
    onFilterChange?.(filter);
    setFilter?.(filter);
  };
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterButton,
            activeFilter === filter && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => handleFilterChange(filter)}
        >
          <Text
            style={[
              styles.filterText,
              { color: activeFilter === filter ? '#FFFFFF' : theme.colors.text },
            ]}
          >
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

