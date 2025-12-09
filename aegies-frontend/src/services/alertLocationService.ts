/**
 * Alert Location Service
 * Handles location-based alert grouping, priority allocation, and location fetching
 */

import { Alert } from '../types';
import * as Location from 'expo-location';

export interface LocationGroupedAlert {
  locationId: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  alerts: PrioritizedAlert[];
  totalPriority: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface PrioritizedAlert extends Alert {
  priorityScore: number;
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  distance?: number; // Distance from user location in km
  timeToWindow?: number; // Minutes until withdrawal window
  recommendedAction: string;
}

/**
 * Calculate priority score for an alert (0-100)
 */
export function calculateAlertPriority(alert: Alert, userLocation?: { latitude: number; longitude: number }): PrioritizedAlert {
  let priorityScore = 0;

  // Risk score weight: 35%
  const riskScore = alert.risk || 0;
  priorityScore += riskScore * 35;

  // Amount weight: 25%
  const amountFactor = Math.min((alert.amount || 0) / 1000000, 1); // Normalize to 0-1
  priorityScore += amountFactor * 25;

  // Time window urgency weight: 25%
  const timeWindow = alert.timeWindow || Infinity;
  const timeUrgency = timeWindow < 30 ? 1.0 :
                      timeWindow < 60 ? 0.7 :
                      timeWindow < 120 ? 0.4 : 0.1;
  priorityScore += timeUrgency * 25;

  // Distance weight: 15% (if user location available)
  let distanceFactor = 0.5; // Default if no user location
  if (userLocation && alert.location) {
    const distance = calculateDistance(
      userLocation,
      alert.location
    );
    distanceFactor = distance < 5 ? 1.0 :
                    distance < 10 ? 0.7 :
                    distance < 20 ? 0.4 : 0.1;
  }
  priorityScore += distanceFactor * 15;

  // Determine priority level
  let priorityLevel: PrioritizedAlert['priorityLevel'];
  if (priorityScore >= 80) priorityLevel = 'critical';
  else if (priorityScore >= 60) priorityLevel = 'high';
  else if (priorityScore >= 40) priorityLevel = 'medium';
  else priorityLevel = 'low';

  // Determine recommended action based on alert type
  let recommendedAction = '';
  if (alert.type === 'high_priority') {
    recommendedAction = 'DEPLOY TEAM IMMEDIATELY';
  } else if (alert.type === 'medium_priority') {
    recommendedAction = 'Monitor and prepare response';
  } else {
    recommendedAction = 'Review and assess';
  }

  return {
    ...alert,
    priorityScore: Math.round(priorityScore),
    priorityLevel,
    distance: userLocation && alert.location ? calculateDistance(userLocation, alert.location) : undefined,
    timeToWindow: alert.timeWindow,
    recommendedAction,
  };
}

/**
 * Group alerts by location (within 500m radius)
 */
export function groupAlertsByLocation(
  alerts: Alert[],
  userLocation?: { latitude: number; longitude: number }
): LocationGroupedAlert[] {
  const grouped: Map<string, PrioritizedAlert[]> = new Map();
  const locationMap: Map<string, { latitude: number; longitude: number; address: string }> = new Map();

  // Calculate priorities for all alerts
  const prioritizedAlerts = alerts.map(alert => 
    calculateAlertPriority(alert, userLocation)
  );

  // Group alerts by location (within 500m)
  prioritizedAlerts.forEach(alert => {
    if (!alert.location) return;

    // Find existing group within 500m
    let foundGroup = false;
    for (const [locationId, location] of locationMap.entries()) {
      const distance = calculateDistance(
        location,
        alert.location
      );
      
      if (distance < 0.5) { // 500m radius
        grouped.get(locationId)?.push(alert);
        foundGroup = true;
        break;
      }
    }

    // Create new group if not found
    if (!foundGroup) {
      const locationId = `loc-${alert.location.latitude.toFixed(4)}-${alert.location.longitude.toFixed(4)}`;
      grouped.set(locationId, [alert]);
      locationMap.set(locationId, {
        latitude: alert.location.latitude,
        longitude: alert.location.longitude,
        address: alert.location.address || 'Location not available',
      });
    }
  });

  // Convert to array and calculate group priorities
  return Array.from(grouped.entries()).map(([locationId, alerts]) => {
    const totalPriority = alerts.reduce((sum, alert) => sum + alert.priorityScore, 0) / alerts.length;
    const maxPriority = Math.max(...alerts.map(a => a.priorityScore));
    
    let riskLevel: LocationGroupedAlert['riskLevel'];
    if (maxPriority >= 80) riskLevel = 'critical';
    else if (maxPriority >= 60) riskLevel = 'high';
    else if (maxPriority >= 40) riskLevel = 'medium';
    else riskLevel = 'low';

    return {
      locationId,
      location: locationMap.get(locationId)!,
      alerts: alerts.sort((a, b) => b.priorityScore - a.priorityScore),
      totalPriority: Math.round(totalPriority),
      riskLevel,
    };
  }).sort((a, b) => b.totalPriority - a.totalPriority);
}

/**
 * Fetch location from address using geocoding
 */
export async function fetchLocationFromAddress(address: string): Promise<{ latitude: number; longitude: number; address: string } | null> {
  try {
    const results = await Location.geocodeAsync(address);
    if (results && results.length > 0) {
      const result = results[0];
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        address: address,
      };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

/**
 * Search locations by query
 */
export async function searchLocations(query: string): Promise<Array<{ latitude: number; longitude: number; address: string }>> {
  try {
    // Use reverse geocoding if query is coordinates
    if (/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(query)) {
      const [lat, lon] = query.split(',').map(Number);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (results && results.length > 0) {
        const result = results[0];
        return [{
          latitude: lat,
          longitude: lon,
          address: `${result.street || ''} ${result.city || ''} ${result.region || ''}`.trim(),
        }];
      }
    }

    // Use forward geocoding for text queries
    const results = await Location.geocodeAsync(query);
    return results.map(result => ({
      latitude: result.latitude,
      longitude: result.longitude,
      address: `${result.street || ''} ${result.city || ''} ${result.region || ''}`.trim() || query,
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.latitude * Math.PI / 180) *
      Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Allocate alerts to officers based on priority and proximity
 */
export function allocateAlertsToOfficers(
  locationGroups: LocationGroupedAlert[],
  officers: Array<{ id: string; location: { latitude: number; longitude: number }; capacity: number }>
): Map<string, string> { // alertId -> officerId
  const assignments = new Map<string, string>();
  const officerWorkload = new Map<string, number>();

  // Initialize workload
  officers.forEach(officer => {
    officerWorkload.set(officer.id, 0);
  });

  // Sort groups by priority
  const sortedGroups = [...locationGroups].sort((a, b) => b.totalPriority - a.totalPriority);

  sortedGroups.forEach(group => {
    group.alerts.forEach(alert => {
      // Find best officer for this alert
      const bestOfficer = officers
        .filter(officer => {
          const currentLoad = officerWorkload.get(officer.id) || 0;
          return currentLoad < officer.capacity;
        })
        .map(officer => {
          const distance = calculateDistance(
            officer.location,
            alert.location!
          );
          const workload = officerWorkload.get(officer.id) || 0;
          const workloadFactor = 1 - (workload / officer.capacity);
          const distanceFactor = distance < 5 ? 1.0 : distance < 10 ? 0.7 : 0.4;
          
          const score = (workloadFactor * 0.5) + (distanceFactor * 0.5);
          return { officer, score, distance };
        })
        .sort((a, b) => b.score - a.score)[0];

      if (bestOfficer) {
        assignments.set(alert.id, bestOfficer.officer.id);
        officerWorkload.set(
          bestOfficer.officer.id,
          (officerWorkload.get(bestOfficer.officer.id) || 0) + 1
        );
      }
    });
  });

  return assignments;
}

