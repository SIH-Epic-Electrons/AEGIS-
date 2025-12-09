import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Animated,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Circle, PROVIDER_DEFAULT, Polyline, Polygon } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/theme';
import * as Location from 'expo-location';
import { locationService } from '../services/locationService';
import { apiService } from '../services/api';
import { getCaseDetails } from '../services/caseService';
import { findNearestTeams, dispatchTeam, trackTeamLocation } from '../services/dispatchService';
import { activateDigitalCordon } from '../services/freezeService';
import { websocketService } from '../services/websocketService';
import { atmService, ATMHotspot } from '../api/atmService';
import {
  groupAlertsByLocation,
  searchLocations,
  fetchLocationFromAddress,
  LocationGroupedAlert,
  PrioritizedAlert,
} from '../services/alertLocationService';
import AlertPriorityList from '../components/AlertPriorityList';
import { ATMAlertModule, ComplaintAlertModule, TeamAlertModule } from '../components/AlertTypeModules';
import LocationAlertCard from '../components/LocationAlertCard';
import { Alert as AlertType } from '../types';

const { width, height } = Dimensions.get('window');

interface Hotspot {
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  probability: number;
  confidence: number;
  timeWindow: {
    start: string;
    end: string;
  };
  riskScore: number;
}

interface Team {
  id: string;
  name: string;
  location: { lat: number; lon: number };
  status: string;
  eta: number;
}

type FilterType = 'all' | 'high-risk' | 'next-30mins' | 'teams' | 'india-view';

// India bounds for map
const INDIA_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

// Simplified India outline polygon coordinates (main boundary)
const INDIA_OUTLINE = [
  { latitude: 35.50, longitude: 77.83 }, // Kashmir
  { latitude: 32.72, longitude: 74.86 }, // Punjab
  { latitude: 29.95, longitude: 73.87 }, // Rajasthan
  { latitude: 23.25, longitude: 68.97 }, // Gujarat coast
  { latitude: 20.27, longitude: 72.83 }, // Gujarat
  { latitude: 15.38, longitude: 73.82 }, // Goa
  { latitude: 11.94, longitude: 75.35 }, // Kerala
  { latitude: 8.08, longitude: 77.55 }, // Kanyakumari
  { latitude: 10.77, longitude: 79.83 }, // Tamil Nadu
  { latitude: 13.08, longitude: 80.27 }, // Chennai
  { latitude: 17.38, longitude: 83.23 }, // Andhra
  { latitude: 20.30, longitude: 85.82 }, // Odisha
  { latitude: 21.75, longitude: 87.09 }, // West Bengal
  { latitude: 24.80, longitude: 88.37 }, // Bangladesh border
  { latitude: 26.20, longitude: 89.95 }, // Assam
  { latitude: 27.80, longitude: 95.83 }, // Arunachal
  { latitude: 28.40, longitude: 97.38 }, // Northeast
  { latitude: 26.91, longitude: 93.71 }, // Nagaland
  { latitude: 23.83, longitude: 91.28 }, // Tripura
  { latitude: 25.57, longitude: 85.14 }, // Bihar
  { latitude: 26.45, longitude: 80.33 }, // UP
  { latitude: 28.61, longitude: 77.21 }, // Delhi
  { latitude: 30.73, longitude: 76.78 }, // Punjab
  { latitude: 32.71, longitude: 74.85 }, // J&K
  { latitude: 35.50, longitude: 77.83 }, // Close loop
];

export default function MapScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const teamPulseAnim = useRef(new Animated.Value(1)).current;

  const { caseId, alertId, alert, location: routeLocation } = (route.params as any) || {};
  const effectiveCaseId = caseId || alertId || 'default-case';

  const [mapRegion, setMapRegion] = useState({
    latitude: routeLocation?.latitude || 19.1364,
    longitude: routeLocation?.longitude || 72.8297,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [victimLocation, setVictimLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [timeWindow, setTimeWindow] = useState<{ start: string; end: string } | null>(null);
  
  // Enhanced features: Multiple alerts with priority
  const [allAlerts, setAllAlerts] = useState<AlertType[]>([]);
  const [locationGroups, setLocationGroups] = useState<LocationGroupedAlert[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<LocationGroupedAlert | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<PrioritizedAlert | null>(null);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [showAlertList, setShowAlertList] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ latitude: number; longitude: number; address: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allAlertsFlat, setAllAlertsFlat] = useState<PrioritizedAlert[]>([]);
  const [atmHotspots, setAtmHotspots] = useState<ATMHotspot[]>([]);
  const [showIndiaView, setShowIndiaView] = useState(false);

  useEffect(() => {
    loadMapData();
    getCurrentLocation();
    setupAnimations();
    setupWebSocketUpdates();
    loadAllAlerts();
    loadATMHotspots();
  }, [effectiveCaseId]);

  // Load ATM hotspots from CST-Transformer predictions
  const loadATMHotspots = async () => {
    try {
      const response = await atmService.getATMHotspots();
      if (response.success && response.data) {
        setAtmHotspots(response.data);
      } else {
        // If API fails, use empty array (mock data will be provided by service)
        setAtmHotspots([]);
      }
    } catch (error) {
      // Silently handle errors - service provides mock data
      setAtmHotspots([]);
    }
  };

  // Load all alerts and group by location
  const loadAllAlerts = async () => {
    try {
      // In production, fetch from API
      const mockAlerts: AlertType[] = [
        {
          id: '1',
          type: 'high_priority',
          title: 'ATM Withdrawal Alert',
          message: 'High probability withdrawal detected',
          timestamp: new Date().toISOString(),
          location: {
            latitude: 19.1364,
            longitude: 72.8297,
            address: 'HDFC ATM, Lokhandwala Complex, Andheri West, Mumbai',
          },
          complaintId: effectiveCaseId,
          amount: 350000,
          status: 'active',
          risk: 0.94,
          timeWindow: 30,
        },
        {
          id: '2',
          type: 'high_priority',
          title: 'Suspicious Transaction',
          message: 'Large amount transfer detected',
          timestamp: new Date().toISOString(),
          location: {
            latitude: 19.1380,
            longitude: 72.8300,
            address: 'ICICI Bank, Andheri West, Mumbai',
          },
          complaintId: effectiveCaseId,
          amount: 210000,
          status: 'active',
          risk: 0.87,
          timeWindow: 45,
        },
      ];
      setAllAlerts(mockAlerts);
      
      // Group alerts by location
      if (userLocation) {
        const grouped = groupAlertsByLocation(mockAlerts, userLocation);
        setLocationGroups(grouped);
        
        // Create flat list of all alerts sorted by priority
        const flatAlerts: PrioritizedAlert[] = [];
        grouped.forEach(group => {
          flatAlerts.push(...group.alerts);
        });
        // Sort by priority score (highest first)
        flatAlerts.sort((a, b) => b.priorityScore - a.priorityScore);
        setAllAlertsFlat(flatAlerts);
        
        if (grouped.length > 0) {
          setSelectedGroup(grouped[0]);
        }
        if (flatAlerts.length > 0) {
          setSelectedAlert(flatAlerts[0]);
          setSelectedAlertIndex(0);
        }
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  // Update location groups when user location changes
  useEffect(() => {
    if (userLocation && allAlerts.length > 0) {
      const grouped = groupAlertsByLocation(allAlerts, userLocation);
      setLocationGroups(grouped);
      
      // Update flat list
      const flatAlerts: PrioritizedAlert[] = [];
      grouped.forEach(group => {
        flatAlerts.push(...group.alerts);
      });
      flatAlerts.sort((a, b) => b.priorityScore - a.priorityScore);
      setAllAlertsFlat(flatAlerts);
    }
  }, [userLocation, allAlerts]);

  // Pulse animation for predicted ATM marker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Pulse animation for team marker
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(teamPulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(teamPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const setupAnimations = () => {
    // Animations are set up in useEffect above
  };

  const setupWebSocketUpdates = () => {
    // Subscribe to team location updates
    const unsubscribe = websocketService.subscribe('team_updates', (update: any) => {
      if (update.teamId && update.location) {
        setTeams((prevTeams) =>
          prevTeams.map((team) =>
            team.id === update.teamId
              ? { ...team, location: { lat: update.location.lat, lon: update.location.lon } }
              : team
          )
        );
      }
    });

    return unsubscribe;
  };

  const loadMapData = async () => {
    try {
      setLoading(true);

      // Load case details if caseId is available
      if (effectiveCaseId && effectiveCaseId !== 'default-case') {
        const caseDetails = await getCaseDetails(effectiveCaseId);
        if (caseDetails.success && caseDetails.data) {
          const prediction = caseDetails.data.prediction;
          
          // Set hotspots from prediction
          if (prediction?.hotspots && prediction.hotspots.length > 0) {
            const mappedHotspots: Hotspot[] = prediction.hotspots.map((h: any) => ({
              id: h.id || `hotspot-${Date.now()}`,
              location: {
                latitude: h.location?.latitude || h.latitude || 19.1364,
                longitude: h.location?.longitude || h.longitude || 72.8297,
              },
              address: h.address || 'Location not available',
              probability: h.probability || 0.94,
              confidence: prediction.confidence || 94,
              timeWindow: prediction.timeWindow || {
                start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                end: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
              },
              riskScore: prediction.riskScore || 0.94,
            }));
            setHotspots(mappedHotspots);
            setSelectedHotspot(mappedHotspots[0]);
            setTimeWindow(mappedHotspots[0].timeWindow);

            // Center map on first hotspot
            if (mappedHotspots[0].location) {
              setMapRegion({
                ...mapRegion,
                latitude: mappedHotspots[0].location.latitude,
                longitude: mappedHotspots[0].location.longitude,
              });
            }
          }

          // Set victim location
          if (caseDetails.data.victim?.location) {
            setVictimLocation({
              latitude: parseFloat(caseDetails.data.victim.location.split(',')[0]) || 19.1380,
              longitude: parseFloat(caseDetails.data.victim.location.split(',')[1]) || 72.8300,
            });
          }
        }
      } else {
        // Load from alert if available
        if (alert) {
          const hotspot: Hotspot = {
            id: alert.id,
            location: {
              latitude: alert.location?.latitude || 19.1364,
              longitude: alert.location?.longitude || 72.8297,
            },
            address: alert.location?.address || 'Location not available',
            probability: alert.risk || 0.94,
            confidence: (alert.risk || 0.94) * 100,
            timeWindow: {
              start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              end: new Date(Date.now() + (alert.timeWindow || 45) * 60 * 1000).toISOString(),
            },
            riskScore: alert.risk || 0.94,
          };
          setHotspots([hotspot]);
          setSelectedHotspot(hotspot);
          setTimeWindow(hotspot.timeWindow);
        } else {
          // Default hotspot for demo
          const defaultHotspot: Hotspot = {
            id: 'default-hotspot',
            location: {
              latitude: 19.1364,
              longitude: 72.8297,
            },
            address: 'HDFC ATM, Lokhandwala Complex, Andheri West, Mumbai - 400053',
            probability: 0.94,
            confidence: 94,
            timeWindow: {
              start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              end: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            },
            riskScore: 0.94,
          };
          setHotspots([defaultHotspot]);
          setSelectedHotspot(defaultHotspot);
          setTimeWindow(defaultHotspot.timeWindow);
        }
      }

      // Load teams
      if (effectiveCaseId && effectiveCaseId !== 'default-case') {
        const teamsResult = await findNearestTeams(effectiveCaseId, {});
        if (teamsResult.success && teamsResult.data) {
          // Map dispatchService Team format to MapScreen Team format
          const mappedTeams: Team[] = teamsResult.data.map((team: any) => ({
            id: team.id,
            name: team.name,
            location: team.currentLocation ? {
              lat: team.currentLocation.lat,
              lon: team.currentLocation.lon,
            } : { lat: 19.1364, lon: 72.8297 },
            status: team.status || 'available',
            eta: team.eta || 0,
          }));
          setTeams(mappedTeams);
        }
      }
    } catch (error) {
      console.error('Error loading map data:', error);
      // Set default data on error
      const defaultHotspot: Hotspot = {
        id: 'default-hotspot',
        location: {
          latitude: 19.1364,
          longitude: 72.8297,
        },
        address: 'HDFC ATM, Lokhandwala Complex, Andheri West, Mumbai - 400053',
        probability: 0.94,
        confidence: 94,
        timeWindow: {
          start: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        },
        riskScore: 0.94,
      };
      setHotspots([defaultHotspot]);
      setSelectedHotspot(defaultHotspot);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    const result = await locationService.getCurrentLocation({
      accuracy: Location.Accuracy.Balanced,
    });
    
    if (result.success && result.location) {
      setUserLocation({
        latitude: result.location.latitude,
        longitude: result.location.longitude,
      });
    } else {
      // Error is already logged and user-friendly message shown by locationService
      if (result.permissionDenied) {
        // Optionally show additional UI feedback
        console.log('Location permission denied');
      }
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      const newRegion = {
        ...mapRegion,
        latitudeDelta: mapRegion.latitudeDelta * 0.5,
        longitudeDelta: mapRegion.longitudeDelta * 0.5,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setMapRegion(newRegion);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const newRegion = {
        ...mapRegion,
        latitudeDelta: mapRegion.latitudeDelta * 2,
        longitudeDelta: mapRegion.longitudeDelta * 2,
      };
      mapRef.current.animateToRegion(newRegion, 300);
      setMapRegion(newRegion);
    }
  };

  const handleMyLocation = async () => {
    try {
      if (userLocation && mapRef.current) {
        const newRegion = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        mapRef.current.animateToRegion(newRegion, 500);
        setMapRegion(newRegion);
      } else {
        await getCurrentLocation();
        if (userLocation && mapRef.current) {
          const newRegion = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          mapRef.current.animateToRegion(newRegion, 500);
          setMapRegion(newRegion);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your location');
    }
  };

  const handleNavigateToLocation = async (location: { latitude: number; longitude: number }) => {
    try {
      const { latitude, longitude } = location;
      const url = Platform.select({
        ios: `maps://maps.apple.com/?daddr=${latitude},${longitude}`,
        android: `google.navigation:q=${latitude},${longitude}`,
      });

      const canOpen = await Linking.canOpenURL(url || '');
      if (canOpen) {
        await Linking.openURL(url || '');
      } else {
        // Fallback to web maps
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open navigation app');
    }
  };

  const handleNavigate = async () => {
    if (selectedAlert?.location) {
      await handleNavigateToLocation(selectedAlert.location);
    } else if (selectedHotspot) {
      await handleNavigateToLocation(selectedHotspot.location);
    }
  };

  const handleDeployTeam = async () => {
    if (!selectedHotspot || !effectiveCaseId) {
      Alert.alert('Error', 'No hotspot selected or case ID missing');
      return;
    }

    try {
      // Navigate to team status screen using parent Stack Navigator
      const parent = navigation.getParent();
      // @ts-ignore - React Navigation type inference limitation
      const nav = parent || navigation;
      // @ts-ignore - React Navigation type inference limitation
      nav.navigate('TeamStatus' as never, {
        caseId: effectiveCaseId,
        hotspot: selectedHotspot,
      } as never);
    } catch (error) {
      Alert.alert('Error', 'Could not deploy team');
    }
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    
    // Handle India view toggle
    if (filter === 'india-view') {
      setShowIndiaView(true);
      if (mapRef.current) {
        mapRef.current.animateToRegion(INDIA_REGION, 500);
        setMapRegion(INDIA_REGION);
      }
    } else {
      setShowIndiaView(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      return;
    }

    try {
      setLoading(true);
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
      
      // If single result, center map on it
      if (results.length === 1) {
        const result = results[0];
        if (mapRef.current) {
          const newRegion = {
            latitude: result.latitude,
            longitude: result.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          mapRef.current.animateToRegion(newRegion, 500);
          setMapRegion(newRegion);
        }
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      Alert.alert('Error', 'Could not search locations');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (location: { latitude: number; longitude: number; address: string }) => {
    setSearchQuery(location.address);
    setShowSearchResults(false);
    if (mapRef.current) {
      const newRegion = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current.animateToRegion(newRegion, 500);
      setMapRegion(newRegion);
    }
  };

  const handleActivateCordon = async () => {
    if (!selectedHotspot || !effectiveCaseId) {
      Alert.alert('Error', 'No hotspot selected');
      return;
    }

    try {
      const result = await activateDigitalCordon(
        effectiveCaseId,
        {
          lat: selectedHotspot.location.latitude,
          lon: selectedHotspot.location.longitude,
        },
        2000 // 2km radius
      );

      if (result.success) {
        Alert.alert('Success', 'Digital Cordon activated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to activate cordon');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to activate cordon');
    }
  };

  const formatTimeWindow = (timeWindow: { start: string; end: string } | null) => {
    if (!timeWindow) return 'N/A';
    try {
      const start = new Date(timeWindow.start);
      const end = new Date(timeWindow.end);
      const startTime = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const endTime = end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      return `${startTime} - ${endTime}`;
    } catch {
      return 'N/A';
    }
  };

  const calculateDistance = (
    loc1: { latitude: number; longitude: number },
    loc2: { latitude: number; longitude: number }
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.latitude * Math.PI) / 180) *
        Math.cos((loc2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getFilteredHotspots = (): Hotspot[] => {
    if (activeFilter === 'all') return hotspots;
    if (activeFilter === 'high-risk') {
      return hotspots.filter((h) => h.riskScore >= 0.85);
    }
    if (activeFilter === 'next-30mins') {
      return hotspots.filter((h) => {
        if (!h.timeWindow) return false;
        const end = new Date(h.timeWindow.end);
        const now = new Date();
        const diffMinutes = (end.getTime() - now.getTime()) / (1000 * 60);
        return diffMinutes <= 30;
      });
    }
    return hotspots;
  };

  const filteredHotspots = getFilteredHotspots();
  const displayHotspot = selectedHotspot || filteredHotspots[0];
  const distance = userLocation && displayHotspot
    ? calculateDistance(userLocation, displayHotspot.location)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: '#f8fafc' }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchBarContent}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={[styles.searchInput, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchTextInput, { color: theme.colors.text }]}
              placeholder="Search location or case..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity
            style={[styles.layersButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => {
              // Map layers or settings action
              Alert.alert('Map Layers', 'Map layer options coming soon');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="layers" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips - Positioned below search bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            activeFilter === 'all' && styles.filterChipActive,
            activeFilter === 'all' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => handleFilterChange('all')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark"
            size={16}
            color={activeFilter === 'all' ? '#FFFFFF' : theme.colors.text}
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All Zones
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: theme.colors.surface }]}
          onPress={() => handleFilterChange('high-risk')}
          activeOpacity={0.7}
        >
          <View style={[styles.filterDot, { backgroundColor: '#ef4444' }]} />
          <Text style={[styles.filterChipText, { color: theme.colors.text }]}>
            High Risk
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: theme.colors.surface }]}
          onPress={() => handleFilterChange('next-30mins')}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={16} color="#f59e0b" />
          <Text style={[styles.filterChipText, { color: theme.colors.text }]}>
            Next 30 mins
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: theme.colors.surface }]}
          onPress={() => handleFilterChange('teams')}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={16} color="#22c55e" />
          <Text style={[styles.filterChipText, { color: theme.colors.text }]}>
            Teams
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            activeFilter === 'india-view' && styles.filterChipActive,
            activeFilter === 'india-view' && { backgroundColor: '#6366f1' },
            { backgroundColor: theme.colors.surface }
          ]}
          onPress={() => handleFilterChange(activeFilter === 'india-view' ? 'all' : 'india-view')}
          activeOpacity={0.7}
        >
          <Ionicons name="earth" size={16} color={activeFilter === 'india-view' ? '#FFFFFF' : '#6366f1'} />
          <Text style={[
            styles.filterChipText,
            activeFilter === 'india-view' && styles.filterChipTextActive,
            { color: activeFilter === 'india-view' ? '#FFFFFF' : theme.colors.text }
          ]}>
            India View
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        toolbarEnabled={false}
        loadingEnabled={true}
        zoomControlEnabled={false}
        rotateEnabled={true}
        pitchEnabled={true}
      >
        {/* India Outline when in India View */}
        {showIndiaView && (
          <Polygon
            coordinates={INDIA_OUTLINE}
            strokeColor="#6366f1"
            strokeWidth={2}
            fillColor="rgba(99, 102, 241, 0.05)"
          />
        )}

        {/* ATM Hotspots from CST-Transformer - shown in India View */}
        {showIndiaView && atmHotspots.map((hotspot) => (
          <React.Fragment key={hotspot.id}>
            {/* Hotspot risk circle */}
            <Circle
              center={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
              radius={hotspot.risk_score > 0.85 ? 50000 : 30000}
              strokeWidth={2}
              strokeColor={
                hotspot.risk_score > 0.9 ? 'rgba(239, 68, 68, 0.4)' :
                hotspot.risk_score > 0.8 ? 'rgba(249, 115, 22, 0.4)' :
                'rgba(59, 130, 246, 0.4)'
              }
              fillColor={
                hotspot.risk_score > 0.9 ? 'rgba(239, 68, 68, 0.15)' :
                hotspot.risk_score > 0.8 ? 'rgba(249, 115, 22, 0.15)' :
                'rgba(59, 130, 246, 0.15)'
              }
            />
            {/* Hotspot marker */}
            <Marker
              coordinate={{ latitude: hotspot.latitude, longitude: hotspot.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                const hotspotAlert: PrioritizedAlert = {
                  id: hotspot.id,
                  type: 'high_priority',
                  title: `${hotspot.name}`,
                  message: `Risk: ${Math.round(hotspot.risk_score * 100)}% | ${hotspot.fraud_type.replace('_', ' ')}`,
                  timestamp: hotspot.predicted_time_window.start,
                  location: {
                    latitude: hotspot.latitude,
                    longitude: hotspot.longitude,
                    address: hotspot.address,
                  },
                  complaintId: '',
                  amount: 0,
                  status: 'active',
                  priorityScore: Math.round(hotspot.risk_score * 100),
                  priorityLevel: hotspot.risk_score > 0.9 ? 'critical' : hotspot.risk_score > 0.8 ? 'high' : 'medium',
                  recommendedAction: `Monitor for cash-out. Predicted: ${new Date(hotspot.predicted_time_window.start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
                };
                setSelectedAlert(hotspotAlert);
                setSelectedHotspot(null);
                if (mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: hotspot.latitude,
                      longitude: hotspot.longitude,
                      latitudeDelta: 0.5,
                      longitudeDelta: 0.5,
                    },
                    300
                  );
                }
              }}
            >
              <View style={styles.pinMarker}>
                <View style={styles.pinContainer}>
                  <LinearGradient
                    colors={
                      hotspot.risk_score > 0.9 ? ['#ef4444', '#dc2626'] :
                      hotspot.risk_score > 0.8 ? ['#f97316', '#ea580c'] :
                      ['#3b82f6', '#2563eb']
                    }
                    style={styles.pinHead}
                  >
                    <Ionicons name="card" size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={[
                    styles.pinPoint,
                    { borderTopColor: hotspot.risk_score > 0.9 ? '#dc2626' : hotspot.risk_score > 0.8 ? '#ea580c' : '#2563eb' }
                  ]} />
                  <View style={[styles.pinBadge, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[
                      styles.pinBadgeText,
                      { color: hotspot.risk_score > 0.9 ? '#dc2626' : hotspot.risk_score > 0.8 ? '#ea580c' : '#2563eb' }
                    ]}>
                      {Math.round(hotspot.risk_score * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Risk Zone Circle - Large radius with color fill around hotspot */}
        {displayHotspot && !showIndiaView && (
          <Circle
            center={displayHotspot.location}
            radius={2000}
            strokeWidth={3}
            strokeColor="rgba(239, 68, 68, 0.6)"
            fillColor="rgba(239, 68, 68, 0.25)"
          />
        )}
        
        {/* Additional inner circle for better visibility */}
        {displayHotspot && !showIndiaView && (
          <Circle
            center={displayHotspot.location}
            radius={1000}
            strokeWidth={2}
            strokeColor="rgba(239, 68, 68, 0.4)"
            fillColor="rgba(239, 68, 68, 0.1)"
          />
        )}

        {/* Alert Markers from Location Groups */}
        {locationGroups.map((group) =>
          group.alerts.map((alert) => {
            if (!alert.location) return null;
            
            const getMarkerColor = (): [string, string] => {
              switch (alert.priorityLevel) {
                case 'critical':
                  return ['#ef4444', '#dc2626'];
                case 'high':
                  return ['#f97316', '#ea580c'];
                case 'medium':
                  return ['#3b82f6', '#2563eb'];
                default:
                  return ['#6b7280', '#4b5563'];
              }
            };

            const getMarkerIcon = () => {
              // Use more descriptive and visually distinct icons based on alert type
              const titleLower = alert.title?.toLowerCase() || '';
              const typeLower = alert.type?.toLowerCase() || '';
              
              // ATM/Withdrawal alerts
              if (titleLower.includes('atm') || titleLower.includes('withdrawal') || titleLower.includes('cash')) {
                return 'cash-outline';
              }
              // Complaint/High Priority alerts
              if (titleLower.includes('complaint') || typeLower.includes('high_priority') || typeLower.includes('complaint')) {
                return 'alert-circle';
              }
              // Team/LEA alerts
              if (titleLower.includes('team') || titleLower.includes('lea') || titleLower.includes('officer')) {
                return 'people';
              }
              // Fraud/Scam alerts
              if (titleLower.includes('fraud') || titleLower.includes('scam') || titleLower.includes('suspicious')) {
                return 'shield-checkmark';
              }
              // Transaction alerts
              if (titleLower.includes('transaction') || titleLower.includes('transfer')) {
                return 'swap-horizontal';
              }
              // Default critical alert
              if (alert.priorityLevel === 'critical') {
                return 'flash';
              }
              // Default high priority
              if (alert.priorityLevel === 'high') {
                return 'warning';
              }
              // Default
              return 'location';
            };

            return (
              <Marker
                key={alert.id}
                coordinate={alert.location}
                anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
              // Close alert list if open
              setShowAlertList(false);
              // Set selected alert
              setSelectedAlert(alert);
              setSelectedHotspot(null); // Clear hotspot selection
              // Find index in flat list
              const index = allAlertsFlat.findIndex(a => a.id === alert.id);
              if (index !== -1) {
                setSelectedAlertIndex(index);
              }
              if (mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...mapRegion,
                    latitude: alert.location!.latitude,
                    longitude: alert.location!.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  300
                );
              }
            }}
              >
                <Animated.View
                  style={[
                    styles.pinMarker,
                    {
                      transform: [{ scale: selectedAlert?.id === alert.id ? pulseAnim : 1 }],
                    },
                  ]}
                >
                  <View style={[styles.pinPulse, { backgroundColor: `${getMarkerColor()[0]}30` }]} />
                  <View style={styles.pinContainer}>
                    <LinearGradient
                      colors={getMarkerColor()}
                      style={styles.pinHead}
                    >
                      <Ionicons name={getMarkerIcon() as any} size={18} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={[styles.pinPoint, { borderTopColor: getMarkerColor()[1] }]} />
                    <View style={[styles.pinBadge, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.pinBadgeText, { color: getMarkerColor()[0] }]}>
                        {alert.priorityScore}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </Marker>
            );
          })
        )}

        {/* Predicted ATM Markers (Legacy hotspots) */}
        {filteredHotspots.map((hotspot) => (
          <Marker
            key={hotspot.id}
            coordinate={hotspot.location}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              // Close alert list if open
              setShowAlertList(false);
              // Set selected hotspot
              setSelectedHotspot(hotspot);
              setSelectedAlert(null); // Clear alert selection
              setTimeWindow(hotspot.timeWindow);
              if (mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...mapRegion,
                    latitude: hotspot.location.latitude,
                    longitude: hotspot.location.longitude,
                  },
                  300
                );
              }
            }}
          >
            <Animated.View
              style={[
                styles.pinMarker,
                {
                  transform: [{ scale: hotspot.id === displayHotspot?.id ? pulseAnim : 1 }],
                },
              ]}
            >
              <View style={[styles.pinPulse, { backgroundColor: 'rgba(239, 68, 68, 0.3)' }]} />
              <View style={styles.pinContainer}>
                <LinearGradient
                  colors={['#ef4444', '#dc2626']}
                  style={styles.pinHead}
                >
                  <Ionicons name="cash" size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={[styles.pinPoint, { borderTopColor: '#dc2626' }]} />
                <View style={[styles.pinBadge, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.pinBadgeText, { color: '#dc2626' }]}>
                    {Math.round(hotspot.confidence)}%
                  </Text>
                </View>
              </View>
            </Animated.View>
          </Marker>
        ))}

        {/* Victim Location */}
        {victimLocation && (
          <Marker
            coordinate={victimLocation}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              // Create a victim alert for the popup
              const victimAlert: PrioritizedAlert = {
                id: 'victim-location',
                type: 'high_priority',
                title: 'Victim Location',
                message: 'Complaint origin location',
                timestamp: new Date().toISOString(),
                location: {
                  latitude: victimLocation.latitude,
                  longitude: victimLocation.longitude,
                  address: 'Victim Location',
                },
                complaintId: effectiveCaseId,
                amount: 0,
                status: 'active',
                priorityScore: 70,
                priorityLevel: 'high',
                recommendedAction: 'Monitor location',
              };
              setSelectedAlert(victimAlert);
              setSelectedHotspot(null);
              if (mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...mapRegion,
                    latitude: victimLocation.latitude,
                    longitude: victimLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  300
                );
              }
            }}
          >
            <View style={styles.pinMarker}>
              <View style={styles.pinContainer}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.pinHead}
                >
                  <Ionicons name="person-circle" size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={[styles.pinPoint, { borderTopColor: '#2563eb' }]} />
              </View>
            </View>
          </Marker>
        )}

        {/* Team Locations */}
        {teams.map((team) => (
          <Marker
            key={team.id}
            coordinate={{ latitude: team.location.lat, longitude: team.location.lon }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              // Create a team alert for the popup
              const teamAlert: PrioritizedAlert = {
                id: team.id,
                type: 'medium_priority',
                title: `LEA Team: ${team.name}`,
                message: `Team status: ${team.status}`,
                timestamp: new Date().toISOString(),
                location: {
                  latitude: team.location.lat,
                  longitude: team.location.lon,
                  address: `Team Location - ETA: ${team.eta}m`,
                },
                complaintId: effectiveCaseId,
                amount: 0,
                status: 'active',
                priorityScore: 50,
                priorityLevel: 'medium',
                recommendedAction: `Team ETA: ${team.eta} minutes`,
                distance: userLocation
                  ? calculateDistance(userLocation, { latitude: team.location.lat, longitude: team.location.lon })
                  : undefined,
              };
              setSelectedAlert(teamAlert);
              setSelectedHotspot(null);
              if (mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    ...mapRegion,
                    latitude: team.location.lat,
                    longitude: team.location.lon,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  300
                );
              }
            }}
          >
            <Animated.View
              style={[
                styles.pinMarker,
                {
                  transform: [{ scale: teamPulseAnim }],
                },
              ]}
            >
              <View style={[styles.pinPulse, { backgroundColor: 'rgba(34, 197, 94, 0.3)' }]} />
              <View style={styles.pinContainer}>
                <LinearGradient
                  colors={['#22c55e', '#16a34a']}
                  style={styles.pinHead}
                >
                  <Ionicons name="people-circle" size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={[styles.pinPoint, { borderTopColor: '#16a34a' }]} />
              </View>
              <View style={[styles.etaBadge, { backgroundColor: '#16a34a' }]}>
                <Text style={styles.etaBadgeText}>ETA {team.eta}m</Text>
              </View>
            </Animated.View>
          </Marker>
        ))}

        {/* Team Path (if deployed) */}
        {teams.length > 0 && displayHotspot && (
          <Polyline
            coordinates={teams.map((team) => ({
              latitude: team.location.lat,
              longitude: team.location.lon,
            }))}
            strokeColor="#22c55e"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>


      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={[styles.zoomButton, { backgroundColor: theme.colors.surface }]}
          onPress={handleZoomIn}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.zoomButton, { backgroundColor: theme.colors.surface }]}
          onPress={handleZoomOut}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: theme.colors.surface }]}
          onPress={handleMyLocation}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Alert Priority List - Positioned lower on screen */}
      {showAlertList && locationGroups.length > 0 && !selectedAlert && (
        <View style={[
          styles.alertListContainer,
          { bottom: 100, zIndex: 18 }
        ]}>
          <View style={styles.alertListHeader}>
            <Text style={[styles.alertListHeaderTitle, { color: theme.colors.text }]}>
              Alerts by Location
            </Text>
            <TouchableOpacity
              onPress={() => setShowAlertList(false)}
              style={styles.alertListCloseButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <AlertPriorityList
            locationGroups={locationGroups}
            selectedGroup={selectedGroup || undefined}
            onGroupSelect={(group) => {
              setSelectedGroup(group);
              if (mapRef.current && group.location) {
                mapRef.current.animateToRegion(
                  {
                    latitude: group.location.latitude,
                    longitude: group.location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  500
                );
              }
            }}
            onAlertSelect={(alert) => {
              // Close the list first
              setShowAlertList(false);
              // Small delay to ensure list closes before showing card
              setTimeout(() => {
                setSelectedAlert(alert);
                // Find index in flat list
                const index = allAlertsFlat.findIndex(a => a.id === alert.id);
                if (index !== -1) {
                  setSelectedAlertIndex(index);
                }
                if (alert.location && mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: alert.location.latitude,
                      longitude: alert.location.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    },
                    500
                  );
                }
              }, 100);
            }}
          />
        </View>
      )}

      {/* Alert Priority List Toggle - Bottom Right */}
      {locationGroups.length > 0 && !showAlertList && !selectedAlert && (
        <TouchableOpacity
          style={[
            styles.alertListToggle,
            { 
              backgroundColor: '#FFFFFF',
              bottom: 100,
              right: 20,
              left: 'auto',
            },
          ]}
          onPress={() => {
            setShowAlertList(true);
            setSelectedAlert(null); // Clear any selected alert when opening list
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={20} color={theme.colors.primary} />
          <Text style={[styles.alertListToggleText, { color: theme.colors.text }]}>
            Alerts ({locationGroups.length})
          </Text>
        </TouchableOpacity>
      )}

      {/* Search Results */}
      {showSearchResults && searchResults.length > 0 && (
        <View style={[styles.searchResults, { backgroundColor: theme.colors.surface }]}>
          <ScrollView style={styles.searchResultsList}>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                style={styles.searchResultItem}
                onPress={() => handleLocationSelect(result)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={20} color={theme.colors.primary} />
                <Text style={[styles.searchResultText, { color: theme.colors.text }]}>
                  {result.address}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Clean Alert Card Navigation - Replaces bottom sheet */}
      {selectedAlert && allAlertsFlat.length > 0 && (
        <View style={[styles.alertCardContainer, { zIndex: 20 }]}>
          {/* Navigation Arrows */}
          {allAlertsFlat.length > 1 && (
            <View style={styles.alertNavigation}>
              <TouchableOpacity
                style={[styles.navArrow, selectedAlertIndex === 0 && styles.navArrowDisabled]}
                onPress={() => {
                  if (selectedAlertIndex > 0) {
                    const newIndex = selectedAlertIndex - 1;
                    setSelectedAlertIndex(newIndex);
                    setSelectedAlert(allAlertsFlat[newIndex]);
                    if (allAlertsFlat[newIndex].location && mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: allAlertsFlat[newIndex].location!.latitude,
                          longitude: allAlertsFlat[newIndex].location!.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        },
                        300
                      );
                    }
                  }
                }}
                disabled={selectedAlertIndex === 0}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="chevron-back" 
                  size={24} 
                  color={selectedAlertIndex === 0 ? '#d1d5db' : '#3b82f6'} 
                />
              </TouchableOpacity>
              
              <View style={styles.alertCounter}>
                <Text style={styles.alertCounterText}>
                  {selectedAlertIndex + 1} / {allAlertsFlat.length}
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.navArrow, selectedAlertIndex === allAlertsFlat.length - 1 && styles.navArrowDisabled]}
                onPress={() => {
                  if (selectedAlertIndex < allAlertsFlat.length - 1) {
                    const newIndex = selectedAlertIndex + 1;
                    setSelectedAlertIndex(newIndex);
                    setSelectedAlert(allAlertsFlat[newIndex]);
                    if (allAlertsFlat[newIndex].location && mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: allAlertsFlat[newIndex].location!.latitude,
                          longitude: allAlertsFlat[newIndex].location!.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        },
                        300
                      );
                    }
                  }
                }}
                disabled={selectedAlertIndex === allAlertsFlat.length - 1}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="chevron-forward" 
                  size={24} 
                  color={selectedAlertIndex === allAlertsFlat.length - 1 ? '#d1d5db' : '#3b82f6'} 
                />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Alert Card */}
          <LocationAlertCard
            alert={selectedAlert}
            index={selectedAlertIndex}
            total={allAlertsFlat.length}
            onNavigate={() => {
              if (selectedAlert.location) {
                handleNavigateToLocation(selectedAlert.location);
              }
            }}
            onDeployTeam={() => {
              if (selectedAlert.complaintId) {
                // Navigate using parent Stack Navigator
                const parent = navigation.getParent();
                // @ts-ignore - React Navigation type inference limitation
                const nav = parent || navigation;
                // @ts-ignore - React Navigation type inference limitation
                nav.navigate('TeamStatus' as never, {
                  caseId: selectedAlert.complaintId,
                  alert: selectedAlert,
                } as never);
              }
            }}
            onViewDetails={() => {
              if (selectedAlert.complaintId) {
                // Navigate using parent Stack Navigator
                const parent = navigation.getParent();
                // @ts-ignore - React Navigation type inference limitation
                const nav = parent || navigation;
                // @ts-ignore - React Navigation type inference limitation
                nav.navigate('CaseDetail' as never, {
                  caseId: selectedAlert.complaintId,
                  alert: selectedAlert,
                } as never);
              }
            }}
            onClose={() => {
              setSelectedAlert(null);
              setSelectedHotspot(null);
              setSelectedAlertIndex(0);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  searchBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
  },
  layersButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  filterContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 100,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  filterChipActive: {
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  // Pin-shaped marker styles
  pinMarker: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 40,
    height: 50,
  },
  pinPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    top: -5,
    left: -10,
    opacity: 0.4,
  },
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 40,
    height: 50,
  },
  pinHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 2,
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pinBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    minWidth: 20,
    alignItems: 'center',
  },
  pinBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  etaBadge: {
    position: 'absolute',
    bottom: -20,
    left: '50%',
    marginLeft: -30,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  etaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  legend: {
    position: 'absolute',
    top: 180,
    left: 16,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    zIndex: 10,
  },
  legendItems: {
    gap: 10,
    paddingVertical: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  zoomControls: {
    position: 'absolute',
    top: 380,
    right: 16,
    zIndex: 10,
    gap: 8,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginTop: 8,
  },
  alertCardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 0,
  },
  alertNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 16,
  },
  navArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navArrowDisabled: {
    opacity: 0.4,
  },
  alertCounter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    zIndex: 20,
  },
  bottomSheetHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#d1d5db',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertListToggle: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    minWidth: 120,
  },
  alertListToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  alertListContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 18,
    maxHeight: height * 0.5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  alertListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  alertListHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  alertListCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResults: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 15,
    borderRadius: 12,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
  },
  bottomSheetContent: {
    padding: 20,
    paddingBottom: 100,
    maxHeight: height * 0.6,
  },
  defaultAlertView: {
    gap: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  locationIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    marginBottom: 6,
  },
  locationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskText: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationDivider: {
    fontSize: 14,
  },
  locationDistance: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeWindow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  timeWindowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeWindowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWindowLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeWindowSubtext: {
    fontSize: 12,
  },
  timeWindowValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  navigateButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  navigateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deployButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deployButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
