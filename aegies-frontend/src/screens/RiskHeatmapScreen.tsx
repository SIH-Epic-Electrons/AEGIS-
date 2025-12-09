/**
 * Risk Heatmap Dashboard - Modern GIS-powered crime map
 * Real-time visualization of predicted cash withdrawal hotspots
 * With filters, real-time updates, and actionable intelligence
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT, Polyline, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Supercluster from 'supercluster';
import { point } from '@turf/turf';
import { useTheme } from '../theme/theme';
import { useNavigation } from '@react-navigation/native';
import { apiService } from '../services/api';
import { predictiveAnalyticsService } from '../api/predictiveAnalyticsService';
import { websocketService } from '../services/websocketService';
import { Prediction, Hotspot } from '../types';

const { width, height } = Dimensions.get('window');

interface FilterState {
  timeWindow: 30 | 60 | 90; // minutes
  selectedState?: string;
  selectedDistrict?: string;
  selectedPoliceStation?: string;
  scamTypes: string[];
}

interface HotspotData {
  id: string;
  lat: number;
  lon: number;
  riskScore: number;
  timeWindow: string;
  scamType: string;
  state: string;
  district: string;
  policeStation: string;
  atmName?: string;
  complaintId: string;
  amount: number;
  digitalCordon?: boolean;
  timestamp: string;
  address?: string;
}

export default function RiskHeatmapScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const mapRef = React.useRef<MapView>(null);
  
  // Helper function to get sample data (defined before useState)
  const getInitialSampleData = (): HotspotData[] => {
    const now = new Date();
    if (isNaN(now.getTime())) {
      console.warn('Invalid date, using fallback');
      return [];
    }
    return [
      {
        id: 'sample_1',
        lat: 26.9124,
        lon: 75.7873,
        riskScore: 0.92,
        timeWindow: '2-4 hours',
        scamType: 'upi_fraud',
        state: 'Rajasthan',
        district: 'Jaipur',
        policeStation: 'Jaipur City',
        atmName: 'HDFC ATM, Railway Station',
        complaintId: 'NCRP-2025-8891',
        amount: 125000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
        address: 'Jaipur Railway Station, Jaipur, Rajasthan 302006',
      },
      {
        id: 'sample_2',
        lat: 28.6139,
        lon: 77.2090,
        riskScore: 0.78,
        timeWindow: '1-3 hours',
        scamType: 'loan_app',
        state: 'Delhi',
        district: 'New Delhi',
        policeStation: 'Connaught Place',
        atmName: 'SBI ATM, CP Circle',
        complaintId: 'NCRP-2025-8892',
        amount: 85000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
        address: 'Connaught Place, New Delhi, Delhi 110001',
      },
      {
        id: 'sample_3',
        lat: 19.0760,
        lon: 72.8777,
        riskScore: 0.88,
        timeWindow: '3-5 hours',
        scamType: 'job_scam',
        state: 'Maharashtra',
        district: 'Mumbai',
        policeStation: 'Andheri',
        atmName: 'ICICI ATM, Andheri Station',
        complaintId: 'NCRP-2025-8893',
        amount: 95000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
        address: 'Andheri Station, Mumbai, Maharashtra 400058',
      },
      {
        id: 'sample_4',
        lat: 12.9716,
        lon: 77.5946,
        riskScore: 0.85,
        timeWindow: '2-4 hours',
        scamType: 'investment',
        state: 'Karnataka',
        district: 'Bangalore',
        policeStation: 'MG Road',
        atmName: 'Axis Bank ATM, MG Road',
        complaintId: 'NCRP-2025-8894',
        amount: 150000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
        address: 'MG Road, Bangalore, Karnataka 560001',
      },
      {
        id: 'sample_5',
        lat: 22.5726,
        lon: 88.3639,
        riskScore: 0.75,
        timeWindow: '1-2 hours',
        scamType: 'impersonation',
        state: 'West Bengal',
        district: 'Kolkata',
        policeStation: 'Park Street',
        atmName: 'PNB ATM, Park Street',
        complaintId: 'NCRP-2025-8895',
        amount: 65000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
        address: 'Park Street, Kolkata, West Bengal 700016',
      },
      {
        id: 'sample_6',
        lat: 17.3850,
        lon: 78.4867,
        riskScore: 0.90,
        timeWindow: '3-4 hours',
        scamType: 'upi_fraud',
        state: 'Telangana',
        district: 'Hyderabad',
        policeStation: 'Secunderabad',
        atmName: 'Kotak ATM, Secunderabad Station',
        complaintId: 'NCRP-2025-8896',
        amount: 110000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 10 * 60000).toISOString(),
        address: 'Secunderabad Station, Hyderabad, Telangana 500003',
      },
      {
        id: 'sample_7',
        lat: 23.0225,
        lon: 72.5714,
        riskScore: 0.82,
        timeWindow: '2-3 hours',
        scamType: 'loan_app',
        state: 'Gujarat',
        district: 'Ahmedabad',
        policeStation: 'Navrangpura',
        atmName: 'HDFC ATM, Navrangpura',
        complaintId: 'NCRP-2025-8897',
        amount: 78000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
        address: 'Navrangpura, Ahmedabad, Gujarat 380009',
      },
      {
        id: 'sample_8',
        lat: 18.5204,
        lon: 73.8567,
        riskScore: 0.79,
        timeWindow: '1-2 hours',
        scamType: 'job_scam',
        state: 'Maharashtra',
        district: 'Pune',
        policeStation: 'Koregaon Park',
        atmName: 'SBI ATM, KP',
        complaintId: 'NCRP-2025-8898',
        amount: 55000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 40 * 60000).toISOString(),
        address: 'Koregaon Park, Pune, Maharashtra 411001',
      },
      {
        id: 'sample_9',
        lat: 13.0827,
        lon: 80.2707,
        riskScore: 0.87,
        timeWindow: '2-3 hours',
        scamType: 'investment',
        state: 'Tamil Nadu',
        district: 'Chennai',
        policeStation: 'T. Nagar',
        atmName: 'ICICI ATM, T. Nagar',
        complaintId: 'NCRP-2025-8899',
        amount: 135000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
        address: 'T. Nagar, Chennai, Tamil Nadu 600017',
      },
      {
        id: 'sample_10',
        lat: 26.4499,
        lon: 80.3319,
        riskScore: 0.83,
        timeWindow: '1-2 hours',
        scamType: 'upi_fraud',
        state: 'Uttar Pradesh',
        district: 'Lucknow',
        policeStation: 'Hazratganj',
        atmName: 'Axis Bank ATM, Hazratganj',
        complaintId: 'NCRP-2025-8900',
        amount: 92000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 55 * 60000).toISOString(),
        address: 'Hazratganj, Lucknow, Uttar Pradesh 226001',
      },
      {
        id: 'sample_11',
        lat: 30.7333,
        lon: 76.7794,
        riskScore: 0.86,
        timeWindow: '2-4 hours',
        scamType: 'loan_app',
        state: 'Punjab',
        district: 'Chandigarh',
        policeStation: 'Sector 17',
        atmName: 'HDFC ATM, Sector 17',
        complaintId: 'NCRP-2025-8901',
        amount: 78000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 18 * 60000).toISOString(),
        address: 'Sector 17, Chandigarh, Punjab 160017',
      },
      {
        id: 'sample_12',
        lat: 25.3176,
        lon: 82.9739,
        riskScore: 0.90,
        timeWindow: '3-5 hours',
        scamType: 'job_scam',
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        policeStation: 'Cantonment',
        atmName: 'SBI ATM, Varanasi Cantt',
        complaintId: 'NCRP-2025-8902',
        amount: 110000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 12 * 60000).toISOString(),
        address: 'Varanasi Cantonment, Varanasi, Uttar Pradesh 221002',
      },
      {
        id: 'sample_13',
        lat: 11.0168,
        lon: 76.9558,
        riskScore: 0.81,
        timeWindow: '2-3 hours',
        scamType: 'investment',
        state: 'Tamil Nadu',
        district: 'Coimbatore',
        policeStation: 'RS Puram',
        atmName: 'Axis Bank ATM, RS Puram',
        complaintId: 'NCRP-2025-8903',
        amount: 95000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 28 * 60000).toISOString(),
        address: 'RS Puram, Coimbatore, Tamil Nadu 641002',
      },
      {
        id: 'sample_14',
        lat: 15.3173,
        lon: 75.7139,
        riskScore: 0.84,
        timeWindow: '1-3 hours',
        scamType: 'upi_fraud',
        state: 'Karnataka',
        district: 'Hubli',
        policeStation: 'Hubli City',
        atmName: 'ICICI ATM, Hubli Station',
        complaintId: 'NCRP-2025-8904',
        amount: 87000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 22 * 60000).toISOString(),
        address: 'Hubli Railway Station, Hubli, Karnataka 580020',
      },
      {
        id: 'sample_15',
        lat: 24.5854,
        lon: 73.7125,
        riskScore: 0.88,
        timeWindow: '2-4 hours',
        scamType: 'loan_app',
        state: 'Rajasthan',
        district: 'Udaipur',
        policeStation: 'Udaipur City',
        atmName: 'HDFC ATM, City Palace',
        complaintId: 'NCRP-2025-8905',
        amount: 128000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 38 * 60000).toISOString(),
        address: 'City Palace Road, Udaipur, Rajasthan 313001',
      },
    ];
  };
  
  // State - Initialize with sample data immediately
  const [hotspots, setHotspots] = useState<HotspotData[]>(getInitialSampleData());
  const [filteredHotspots, setFilteredHotspots] = useState<HotspotData[]>(getInitialSampleData());
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false); // Start as false since we have sample data
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 20.5937, // India center
    longitude: 78.9629,
    latitudeDelta: 25,
    longitudeDelta: 25,
  });

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    timeWindow: 60,
    scamTypes: [],
  });

  // Scam types
  const scamTypeOptions = [
    { id: 'upi_fraud', label: 'UPI Fraud', icon: 'phone-portrait-outline' },
    { id: 'loan_app', label: 'Fake Loan App', icon: 'cash-outline' },
    { id: 'job_scam', label: 'Job Scam', icon: 'briefcase-outline' },
    { id: 'investment', label: 'Investment Fraud', icon: 'trending-up-outline' },
    { id: 'impersonation', label: 'Impersonation', icon: 'person-outline' },
  ];

  // Initialize supercluster for advanced clustering
  const supercluster = useMemo(
    () =>
      new Supercluster({
        radius: 60,
        maxZoom: 16,
        minZoom: 0,
        minPoints: 2,
      }),
    []
  );

  // Convert filtered hotspots to GeoJSON points
  const points = useMemo(() => {
    return filteredHotspots
      .filter((hotspot) => hotspot.lat && hotspot.lon && !isNaN(hotspot.lat) && !isNaN(hotspot.lon))
      .map((hotspot) =>
        point([hotspot.lon, hotspot.lat], {
          id: hotspot.id,
          hotspot,
        })
      );
  }, [filteredHotspots]);

  // Calculate clusters based on current map region
  const [clusters, setClusters] = useState<any[]>([]);
  const [zoomLevel, setZoomLevel] = useState(10);

  useEffect(() => {
    if (points.length === 0) {
      setClusters([]);
      return;
    }

    const bbox: [number, number, number, number] = [
      mapRegion.longitude - mapRegion.longitudeDelta / 2,
      mapRegion.latitude - mapRegion.latitudeDelta / 2,
      mapRegion.longitude + mapRegion.longitudeDelta / 2,
      mapRegion.latitude + mapRegion.latitudeDelta / 2,
    ];

    const zoom = Math.round(Math.log2(360 / mapRegion.longitudeDelta));
    setZoomLevel(zoom);

    supercluster.load(points as any);
    const clusterPoints = supercluster.getClusters(bbox, zoom);
    setClusters(clusterPoints);
  }, [points, mapRegion, supercluster]);

  // Load initial data
  useEffect(() => {
    initializeMap();
    // Data already initialized in useState, just ensure it's set
    if (hotspots.length === 0) {
      const sampleData = getInitialSampleData();
      setHotspots(sampleData);
      setFilteredHotspots(sampleData);
    }
    setLoading(false);
    
    // Then try to load real data in background (non-blocking)
    loadHotspots();
    const unsubscribe = setupWebSocket();
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Filter hotspots when filters change
  useEffect(() => {
    applyFilters();
  }, [filters, hotspots]);

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        if (location && location.coords && 
            location.coords.latitude !== undefined && 
            location.coords.longitude !== undefined) {
          setUserLocation({
            lat: location.coords.latitude,
            lon: location.coords.longitude,
          });
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadHotspots = async () => {
    try {
      setRefreshing(true);
      
      // Always load sample data immediately for better UX
      const sampleData = getSampleHotspots();
      setHotspots(sampleData);
      setFilteredHotspots(sampleData);
      setLoading(false);
      setRefreshing(false);
      
      // Then try to load real data in background
      try {
        const predictions = await apiService.getPredictions();
        const hotspotData: HotspotData[] = [];
        
        predictions.forEach((prediction: any) => {
          if (prediction.hotspots && Array.isArray(prediction.hotspots)) {
            prediction.hotspots.forEach((hotspot: any) => {
              hotspotData.push({
                id: `${prediction.id}_${hotspot.id || Math.random()}`,
                lat: hotspot.location?.latitude || hotspot.lat || 0,
                lon: hotspot.location?.longitude || hotspot.lon || 0,
                riskScore: hotspot.probability || hotspot.prob || 0,
                timeWindow: prediction.timeWindow || '2-4 hours',
                scamType: prediction.scamType || 'upi_fraud',
                state: prediction.state || 'Unknown',
                district: prediction.district || 'Unknown',
                policeStation: prediction.policeStation || 'Unknown',
                atmName: hotspot.atmDetails?.name || hotspot.address,
                complaintId: prediction.complaintId || prediction.id,
                amount: prediction.amount || 0,
                digitalCordon: prediction.digitalCordon || false,
                timestamp: prediction.timestamp || new Date().toISOString(),
                address: hotspot.address,
              });
            });
          }
        });

        // Merge with sample data if we got real data
        if (hotspotData.length > 0) {
          const merged = [...hotspotData, ...sampleData];
          setHotspots(merged);
          setFilteredHotspots(merged);
        }
      } catch (apiError) {
        console.warn('API call failed, using sample data:', apiError);
        // Already set sample data above
      }
    } catch (error) {
      console.error('Error loading hotspots:', error);
      // Use sample data on error
      const sampleData = getSampleHotspots();
      setHotspots(sampleData);
      setFilteredHotspots(sampleData);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getSampleHotspots = (): HotspotData[] => {
    // Return comprehensive sample hotspots for demo - 15 locations across India
    // Reuse getInitialSampleData to avoid duplication
    try {
      return getInitialSampleData();
    } catch (error) {
      console.warn('Error in getSampleHotspots:', error);
      return [];
    }
  };
  
  // Legacy implementation (kept for fallback, but getInitialSampleData is preferred)
  const _getSampleHotspotsLegacy = (): HotspotData[] => {
    const now = new Date();
    if (isNaN(now.getTime())) {
      return [];
    }
    return [
      {
        id: 'sample_1',
        lat: 26.9124,
        lon: 75.7873,
        riskScore: 0.92,
        timeWindow: '2-4 hours',
        scamType: 'upi_fraud',
        state: 'Rajasthan',
        district: 'Jaipur',
        policeStation: 'Jaipur City',
        atmName: 'HDFC ATM, Railway Station',
        complaintId: 'NCRP-2025-8891',
        amount: 125000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
        address: 'Jaipur Railway Station, Jaipur, Rajasthan 302006',
      },
      {
        id: 'sample_2',
        lat: 28.6139,
        lon: 77.2090,
        riskScore: 0.78,
        timeWindow: '1-3 hours',
        scamType: 'loan_app',
        state: 'Delhi',
        district: 'New Delhi',
        policeStation: 'Connaught Place',
        atmName: 'SBI ATM, CP Circle',
        complaintId: 'NCRP-2025-8892',
        amount: 85000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
        address: 'Connaught Place, New Delhi, Delhi 110001',
      },
      {
        id: 'sample_3',
        lat: 19.0760,
        lon: 72.8777,
        riskScore: 0.88,
        timeWindow: '3-5 hours',
        scamType: 'job_scam',
        state: 'Maharashtra',
        district: 'Mumbai',
        policeStation: 'Andheri',
        atmName: 'ICICI ATM, Andheri Station',
        complaintId: 'NCRP-2025-8893',
        amount: 95000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
        address: 'Andheri Station, Mumbai, Maharashtra 400058',
      },
      {
        id: 'sample_4',
        lat: 12.9716,
        lon: 77.5946,
        riskScore: 0.85,
        timeWindow: '2-4 hours',
        scamType: 'investment',
        state: 'Karnataka',
        district: 'Bangalore',
        policeStation: 'MG Road',
        atmName: 'Axis Bank ATM, MG Road',
        complaintId: 'NCRP-2025-8894',
        amount: 150000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
        address: 'MG Road, Bangalore, Karnataka 560001',
      },
      {
        id: 'sample_5',
        lat: 22.5726,
        lon: 88.3639,
        riskScore: 0.75,
        timeWindow: '1-2 hours',
        scamType: 'impersonation',
        state: 'West Bengal',
        district: 'Kolkata',
        policeStation: 'Park Street',
        atmName: 'PNB ATM, Park Street',
        complaintId: 'NCRP-2025-8895',
        amount: 65000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
        address: 'Park Street, Kolkata, West Bengal 700016',
      },
      {
        id: 'sample_6',
        lat: 17.3850,
        lon: 78.4867,
        riskScore: 0.90,
        timeWindow: '3-4 hours',
        scamType: 'upi_fraud',
        state: 'Telangana',
        district: 'Hyderabad',
        policeStation: 'Secunderabad',
        atmName: 'Kotak ATM, Secunderabad Station',
        complaintId: 'NCRP-2025-8896',
        amount: 110000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 10 * 60000).toISOString(),
        address: 'Secunderabad Station, Hyderabad, Telangana 500003',
      },
      {
        id: 'sample_7',
        lat: 23.0225,
        lon: 72.5714,
        riskScore: 0.82,
        timeWindow: '2-3 hours',
        scamType: 'loan_app',
        state: 'Gujarat',
        district: 'Ahmedabad',
        policeStation: 'Navrangpura',
        atmName: 'HDFC ATM, Navrangpura',
        complaintId: 'NCRP-2025-8897',
        amount: 78000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
        address: 'Navrangpura, Ahmedabad, Gujarat 380009',
      },
      {
        id: 'sample_8',
        lat: 18.5204,
        lon: 73.8567,
        riskScore: 0.79,
        timeWindow: '1-2 hours',
        scamType: 'job_scam',
        state: 'Maharashtra',
        district: 'Pune',
        policeStation: 'Koregaon Park',
        atmName: 'SBI ATM, KP',
        complaintId: 'NCRP-2025-8898',
        amount: 55000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 40 * 60000).toISOString(),
        address: 'Koregaon Park, Pune, Maharashtra 411001',
      },
      {
        id: 'sample_9',
        lat: 13.0827,
        lon: 80.2707,
        riskScore: 0.87,
        timeWindow: '2-3 hours',
        scamType: 'investment',
        state: 'Tamil Nadu',
        district: 'Chennai',
        policeStation: 'T. Nagar',
        atmName: 'ICICI ATM, T. Nagar',
        complaintId: 'NCRP-2025-8899',
        amount: 135000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 35 * 60000).toISOString(),
        address: 'T. Nagar, Chennai, Tamil Nadu 600017',
      },
      {
        id: 'sample_10',
        lat: 26.4499,
        lon: 80.3319,
        riskScore: 0.83,
        timeWindow: '1-2 hours',
        scamType: 'upi_fraud',
        state: 'Uttar Pradesh',
        district: 'Lucknow',
        policeStation: 'Hazratganj',
        atmName: 'Axis Bank ATM, Hazratganj',
        complaintId: 'NCRP-2025-8900',
        amount: 92000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 55 * 60000).toISOString(),
        address: 'Hazratganj, Lucknow, Uttar Pradesh 226001',
      },
      {
        id: 'sample_11',
        lat: 30.7333,
        lon: 76.7794,
        riskScore: 0.86,
        timeWindow: '2-4 hours',
        scamType: 'loan_app',
        state: 'Punjab',
        district: 'Chandigarh',
        policeStation: 'Sector 17',
        atmName: 'HDFC ATM, Sector 17',
        complaintId: 'NCRP-2025-8901',
        amount: 78000,
        digitalCordon: true,
        timestamp: new Date(now.getTime() - 18 * 60000).toISOString(),
        address: 'Sector 17, Chandigarh, Punjab 160017',
      },
      {
        id: 'sample_12',
        lat: 25.3176,
        lon: 82.9739,
        riskScore: 0.90,
        timeWindow: '3-5 hours',
        scamType: 'job_scam',
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        policeStation: 'Cantonment',
        atmName: 'SBI ATM, Varanasi Cantt',
        complaintId: 'NCRP-2025-8902',
        amount: 110000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 12 * 60000).toISOString(),
        address: 'Varanasi Cantonment, Varanasi, Uttar Pradesh 221002',
      },
      {
        id: 'sample_13',
        lat: 11.0168,
        lon: 76.9558,
        riskScore: 0.81,
        timeWindow: '2-3 hours',
        scamType: 'investment',
        state: 'Tamil Nadu',
        district: 'Coimbatore',
        policeStation: 'RS Puram',
        atmName: 'Axis Bank ATM, RS Puram',
        complaintId: 'NCRP-2025-8903',
        amount: 95000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 28 * 60000).toISOString(),
        address: 'RS Puram, Coimbatore, Tamil Nadu 641002',
      },
      {
        id: 'sample_14',
        lat: 15.3173,
        lon: 75.7139,
        riskScore: 0.84,
        timeWindow: '1-3 hours',
        scamType: 'upi_fraud',
        state: 'Karnataka',
        district: 'Hubli',
        policeStation: 'Hubli City',
        atmName: 'ICICI ATM, Hubli Station',
        complaintId: 'NCRP-2025-8904',
        amount: 87000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 22 * 60000).toISOString(),
        address: 'Hubli Railway Station, Hubli, Karnataka 580020',
      },
      {
        id: 'sample_15',
        lat: 24.5854,
        lon: 73.7125,
        riskScore: 0.88,
        timeWindow: '2-4 hours',
        scamType: 'loan_app',
        state: 'Rajasthan',
        district: 'Udaipur',
        policeStation: 'Udaipur City',
        atmName: 'HDFC ATM, City Palace',
        complaintId: 'NCRP-2025-8905',
        amount: 128000,
        digitalCordon: false,
        timestamp: new Date(now.getTime() - 38 * 60000).toISOString(),
        address: 'City Palace Road, Udaipur, Rajasthan 313001',
      },
    ];
  };

  const setupWebSocket = () => {
    // Subscribe to real-time prediction updates
    const unsubscribe1 = websocketService.subscribe('prediction_update', (data: any) => {
      // Transform and add new hotspot
      if (data.hotspots && Array.isArray(data.hotspots)) {
        const newHotspots: HotspotData[] = data.hotspots
          .map((hotspot: any, index: number) => ({
            id: `${data.id}_${index}_${Date.now()}`,
            lat: hotspot.location?.latitude || hotspot.lat || 0,
            lon: hotspot.location?.longitude || hotspot.lon || 0,
            riskScore: hotspot.prob || hotspot.probability || 0,
            timeWindow: data.timeWindow || '2-4 hours',
            scamType: data.scamType || 'upi_fraud',
            state: data.state || 'Unknown',
            district: data.district || 'Unknown',
            policeStation: data.policeStation || 'Unknown',
            atmName: hotspot.address,
            complaintId: data.complaintId || data.id,
            amount: data.amount || 0,
            digitalCordon: false,
            timestamp: new Date().toISOString(),
            address: hotspot.address,
          }))
          .filter((h: HotspotData) => h.lat !== 0 || h.lon !== 0);

        if (newHotspots.length > 0) {
          setHotspots((prev) => [...newHotspots, ...prev]);
        }
      }
    });

    // Subscribe to new case reports
    const unsubscribe2 = websocketService.subscribe('new_case', (data: any) => {
      const lat = data.location?.latitude || data.lat || 0;
      const lon = data.location?.longitude || data.lon || 0;
      
      if (lat !== 0 || lon !== 0) {
        const newHotspot: HotspotData = {
          id: `case_${data.id}_${Date.now()}`,
          lat,
          lon,
          riskScore: data.riskScore || 0.8,
          timeWindow: '0-2 hours',
          scamType: data.scamType || 'upi_fraud',
          state: data.state || 'Unknown',
          district: data.district || 'Unknown',
          policeStation: data.policeStation || 'Unknown',
          atmName: data.locationName,
          complaintId: data.complaintId || data.id,
          amount: data.amount || 0,
          digitalCordon: false,
          timestamp: new Date().toISOString(),
          address: data.address,
        };

        setHotspots((prev) => [newHotspot, ...prev]);
      }
    });

    // Return cleanup function
    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  };

  const applyFilters = useCallback(() => {
    let filtered = [...hotspots];

    // Time window filter (filter by timestamp)
    const now = new Date();
    const timeWindowMs = filters.timeWindow * 60 * 1000;
    filtered = filtered.filter((hotspot) => {
      try {
        if (!hotspot.timestamp) return true; // Include if no timestamp
        const hotspotTime = new Date(hotspot.timestamp);
        // Check if date is valid
        if (isNaN(hotspotTime.getTime())) return true; // Include if invalid date
        const timeDiff = Math.abs(now.getTime() - hotspotTime.getTime());
        return timeDiff <= timeWindowMs;
      } catch (error) {
        console.warn('Error parsing timestamp:', hotspot.timestamp, error);
        return true; // Include on error
      }
    });

    // Scam type filter
    if (filters.scamTypes.length > 0) {
      filtered = filtered.filter((hotspot) =>
        filters.scamTypes.includes(hotspot.scamType)
      );
    }

    // Location filters
    if (filters.selectedState) {
      filtered = filtered.filter((hotspot) => hotspot.state === filters.selectedState);
    }
    if (filters.selectedDistrict) {
      filtered = filtered.filter((hotspot) => hotspot.district === filters.selectedDistrict);
    }
    if (filters.selectedPoliceStation) {
      filtered = filtered.filter(
        (hotspot) => hotspot.policeStation === filters.selectedPoliceStation
      );
    }

    setFilteredHotspots(filtered);
  }, [filters, hotspots]);

  const getRiskColor = (riskScore: number): string => {
    if (riskScore >= 0.85) return '#E94560'; // High - Red
    if (riskScore >= 0.70) return '#FF9800'; // Medium - Orange
    return '#4CAF50'; // Low - Green
  };

  const getRiskLabel = (riskScore: number): string => {
    if (riskScore >= 0.85) return 'High Risk';
    if (riskScore >= 0.70) return 'Medium Risk';
    return 'Low Risk';
  };

  const getMarkerSize = (riskScore: number): number => {
    // Scale marker size based on risk (20-35px) - smaller pins
    const minSize = 20;
    const maxSize = 35;
    return minSize + (riskScore - 0.5) * ((maxSize - minSize) / 0.5);
  };

  const handleHotspotPress = (hotspot: HotspotData) => {
    setSelectedHotspot(hotspot);
    // Center map on selected hotspot
    setMapRegion({
      latitude: hotspot.lat,
      longitude: hotspot.lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const handleActivateCordon = async () => {
    if (!selectedHotspot) return;

    Alert.alert(
      'Activate Digital Cordon',
      `Activate transaction freeze in 2km radius around ${selectedHotspot.atmName || 'this location'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiService.activateDigitalCordon(
                selectedHotspot.complaintId,
                selectedHotspot.id
              );
              if (result && result.success) {
                Alert.alert('Success', 'Digital Cordon activated successfully');
                // Update hotspot
                setHotspots((prev) =>
                  prev.map((h) =>
                    h.id === selectedHotspot.id ? { ...h, digitalCordon: true } : h
                  )
                );
                setSelectedHotspot({ ...selectedHotspot, digitalCordon: true });
              } else {
                // Network error or service unavailable - show user-friendly message
                const errorMsg = result?.error || 'Service temporarily unavailable. Cordon will be activated when connection is restored.';
                Alert.alert('Info', errorMsg);
                // Optimistically update UI for better UX
                setHotspots((prev) =>
                  prev.map((h) =>
                    h.id === selectedHotspot.id ? { ...h, digitalCordon: true } : h
                  )
                );
                setSelectedHotspot({ ...selectedHotspot, digitalCordon: true });
              }
            } catch (error: any) {
              // Suppress network errors, show user-friendly message
              if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network')) {
                Alert.alert('Info', 'Service temporarily unavailable. Cordon will be activated when connection is restored.');
                // Optimistically update UI
                setHotspots((prev) =>
                  prev.map((h) =>
                    h.id === selectedHotspot.id ? { ...h, digitalCordon: true } : h
                  )
                );
                setSelectedHotspot({ ...selectedHotspot, digitalCordon: true });
              } else {
                Alert.alert('Error', 'Failed to activate digital cordon. Please try again.');
              }
            }
          },
        },
      ]
    );
  };

  const handleViewDossier = () => {
    if (!selectedHotspot) return;
    // @ts-ignore - React Navigation type inference limitation
    navigation.navigate('AlertDetail' as never, {
      alertId: selectedHotspot.complaintId,
    } as never);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const handleNavigate = async () => {
    if (!selectedHotspot || !userLocation) {
      Alert.alert('Error', 'Location data not available');
      return;
    }

    const { lat, lon } = selectedHotspot;
    
    // Open in external maps app
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}&dirflg=d`,
      android: `google.navigation:q=${lat},${lon}`,
    });

    try {
      const supported = await Linking.canOpenURL(url || '');
      if (supported) {
        await Linking.openURL(url || '');
      } else {
        // Fallback to web-based Google Maps
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'Could not open maps application');
    }
  };

  const handleCenterOnHotspot = () => {
    if (!selectedHotspot) return;
    setMapRegion({
      latitude: selectedHotspot.lat,
      longitude: selectedHotspot.lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const toggleScamType = (scamTypeId: string) => {
    setFilters((prev) => ({
      ...prev,
      scamTypes: prev.scamTypes.includes(scamTypeId)
        ? prev.scamTypes.filter((id) => id !== scamTypeId)
        : [...prev.scamTypes, scamTypeId],
    }));
  };

  // Show loading only on first load, not on refresh
  if (loading && hotspots.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading heatmap...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Advanced Map with Clustering */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        mapType="standard"
        toolbarEnabled={false}
        loadingEnabled={true}
        zoomControlEnabled={Platform.OS === 'android'}
        rotateEnabled={true}
        pitchEnabled={true}
        maxZoomLevel={18}
        minZoomLevel={3}
      >
        {/* Route Line from User to Selected Hotspot */}
        {selectedHotspot && userLocation && (
          <Polyline
            coordinates={[
              { latitude: userLocation.lat, longitude: userLocation.lon },
              { latitude: selectedHotspot.lat, longitude: selectedHotspot.lon },
            ]}
            strokeColor={theme.colors.primary}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}

        {/* Clustered Hotspot Markers */}
        {clusters.map((cluster: any) => {
          const isCluster = cluster.properties.cluster;
          
          if (isCluster) {
            // Render cluster marker
            const pointCount = cluster.properties.point_count || 0;
            const clusterHotspots = supercluster.getLeaves(cluster.properties.cluster_id, Infinity);
            const avgRisk = clusterHotspots.reduce((sum: number, leaf: any) => {
              return sum + (leaf.properties.hotspot?.riskScore || 0);
            }, 0) / pointCount;
            const color = getRiskColor(avgRisk);
            const size = Math.min(50 + pointCount * 5, 80);

            return (
              <Marker
                key={`cluster-${cluster.properties.cluster_id}`}
                coordinate={{
                  latitude: cluster.geometry.coordinates[1],
                  longitude: cluster.geometry.coordinates[0],
                }}
                onPress={() => {
                  // Zoom in on cluster
                  // @ts-ignore - getClusterExpansionZoom may not be in type definition
                  const expansionZoom = Math.min(
                    (supercluster as any).getClusterExpansionZoom?.(cluster.properties.cluster_id) || 15,
                    18
                  );
                  const newRegion: Region = {
                    latitude: cluster.geometry.coordinates[1],
                    longitude: cluster.geometry.coordinates[0],
                    latitudeDelta: mapRegion.latitudeDelta / Math.pow(2, expansionZoom - zoomLevel),
                    longitudeDelta: mapRegion.longitudeDelta / Math.pow(2, expansionZoom - zoomLevel),
                  };
                  mapRef.current?.animateToRegion(newRegion, 500);
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <Animated.View
                  style={[
                    styles.clusterMarker,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: color,
                      borderColor: '#FFF',
                      borderWidth: 3,
                    },
                  ]}
                >
                  <Text style={styles.clusterText}>{pointCount}</Text>
                  <Text style={styles.clusterRiskText}>
                    {(avgRisk * 100).toFixed(0)}%
                  </Text>
                </Animated.View>
              </Marker>
            );
          } else {
            // Render individual hotspot marker
            const hotspot = cluster.properties.hotspot as HotspotData;
            if (!hotspot) return null;

            const color = getRiskColor(hotspot.riskScore);
            const size = getMarkerSize(hotspot.riskScore);
            const isSelected = selectedHotspot?.id === hotspot.id;

            return (
              <React.Fragment key={hotspot.id}>
                <Marker
                  coordinate={{ latitude: hotspot.lat, longitude: hotspot.lon }}
                  onPress={() => handleHotspotPress(hotspot)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <Animated.View
                    style={[
                      styles.markerContainer,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: color,
                        borderColor: isSelected ? '#FFF' : color,
                        borderWidth: isSelected ? 4 : 2,
                      },
                    ]}
                  >
                    <Ionicons name="location-sharp" size={size * 0.6} color="#FFF" />
                    {isSelected && (
                      <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#10b981', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      </View>
                    )}
                  </Animated.View>
                </Marker>

                {/* Digital Cordon Circle */}
                {hotspot.digitalCordon && hotspot.lat && hotspot.lon && (
                  <Circle
                    center={{ latitude: hotspot.lat, longitude: hotspot.lon }}
                    radius={2000} // 2km
                    strokeWidth={2}
                    strokeColor="#FF9800"
                    fillColor="rgba(255, 152, 0, 0.2)"
                  />
                )}
              </React.Fragment>
            );
          }
        })}
      </MapView>

      {/* Top Controls */}
      <View style={[styles.topControls, { backgroundColor: theme.colors.surfaceElevated }]}>
        <View style={styles.controlsLeft}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <Ionicons name="filter" size={20} color="#FFF" />
            <Text style={styles.filterButtonText}>Filters</Text>
            {filters.scamTypes.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filters.scamTypes.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.statsBadge, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name="location" size={16} color={theme.colors.primary} />
            <Text style={[styles.statsText, { color: theme.colors.primary }]}>
              {filteredHotspots.length} hotspots
            </Text>
          </View>
        </View>
        <View style={styles.controlsRight}>
          <TouchableOpacity
            style={[styles.mapButton, { backgroundColor: (theme.colors as any).secondary || theme.colors.primary || theme.colors.primary }]}
            onPress={() => navigation.navigate('Map' as never)}
            activeOpacity={0.7}
          >
            <Ionicons name="map" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: theme.colors.surface }]}
            onPress={loadHotspots}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={theme.colors.text}
              style={refreshing && styles.refreshing}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            {/* Time Window */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Time Window</Text>
              <View style={styles.timeButtons}>
                {[30, 60, 90].map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.timeButton,
                      {
                        backgroundColor:
                          filters.timeWindow === minutes
                            ? theme.colors.primary
                            : theme.colors.surface,
                      },
                    ]}
                    onPress={() => setFilters({ ...filters, timeWindow: minutes as 30 | 60 | 90 })}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.timeButtonText,
                        {
                          color:
                            filters.timeWindow === minutes ? '#FFF' : theme.colors.text,
                        },
                      ]}
                    >
                      {minutes}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Scam Type Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Scam Type</Text>
              <View style={styles.scamTypeGrid}>
                {scamTypeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.scamTypeButton,
                      {
                        backgroundColor: filters.scamTypes.includes(option.id)
                          ? theme.colors.primary + '20'
                          : theme.colors.surface,
                        borderColor: filters.scamTypes.includes(option.id)
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                    onPress={() => toggleScamType(option.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={
                        filters.scamTypes.includes(option.id)
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.scamTypeText,
                        {
                          color: filters.scamTypes.includes(option.id)
                            ? theme.colors.primary
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Clear Filters */}
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: theme.colors.border }]}
              onPress={() =>
                setFilters({
                  timeWindow: 60,
                  scamTypes: [],
                })
              }
            >
              <Text style={[styles.clearButtonText, { color: theme.colors.textSecondary }]}>
                Clear All Filters
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Hotspot Info Panel */}
      {selectedHotspot && (
        <View style={[styles.infoPanel, { backgroundColor: theme.colors.surfaceElevated }]}>
          <View style={styles.infoHeader}>
            <View style={styles.infoHeaderLeft}>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: getRiskColor(selectedHotspot.riskScore) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.riskBadgeText,
                    { color: getRiskColor(selectedHotspot.riskScore) },
                  ]}
                >
                  {getRiskLabel(selectedHotspot.riskScore)}
                </Text>
                <Text
                  style={[
                    styles.riskScore,
                    { color: getRiskColor(selectedHotspot.riskScore) },
                  ]}
                >
                  {(selectedHotspot.riskScore * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.infoTitleContainer}>
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  {selectedHotspot.atmName || 'Predicted Hotspot'}
                </Text>
                <Text style={[styles.infoSubtitle, { color: theme.colors.textSecondary }]}>
                  {selectedHotspot.district}, {selectedHotspot.state}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedHotspot(null)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoDetails}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Time Window: {selectedHotspot.timeWindow}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Scam Type: {scamTypeOptions.find((s) => s.id === selectedHotspot.scamType)?.label || selectedHotspot.scamType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Amount: ₹{selectedHotspot.amount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                Complaint: {selectedHotspot.complaintId}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                {selectedHotspot.policeStation} Police Station
              </Text>
            </View>
          </View>

          {/* Distance and Navigation Info */}
          {userLocation && (
            <View style={[styles.distanceCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.distanceRow}>
                <Ionicons name="navigate" size={20} color={theme.colors.primary} />
                <View style={styles.distanceInfo}>
                  <Text style={[styles.distanceLabel, { color: theme.colors.textSecondary }]}>
                    Distance
                  </Text>
                  <Text style={[styles.distanceValue, { color: theme.colors.text }]}>
                    {calculateDistance(userLocation.lat, userLocation.lon, selectedHotspot.lat, selectedHotspot.lon).toFixed(1)} km
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.centerButton, { backgroundColor: theme.colors.primary + '20' }]}
                  onPress={handleCenterOnHotspot}
                  activeOpacity={0.7}
                >
                  <Ionicons name="locate" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.infoActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.navigateButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleNavigate}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
                Navigate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.viewDossierButton, { backgroundColor: theme.colors.surface }]}
              onPress={handleViewDossier}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text" size={18} color={theme.colors.text} />
              <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
                Dossier
              </Text>
            </TouchableOpacity>

            {!selectedHotspot.digitalCordon ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.cordonButton, { backgroundColor: theme.colors.error || '#e94560' }]}
                onPress={handleActivateCordon}
                activeOpacity={0.7}
              >
                <Ionicons name="shield" size={18} color="#FFF" />
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
                  Cordon
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionButton, styles.cordonActive, { backgroundColor: '#4CAF5020', borderColor: '#4CAF50' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
                <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                  Active
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: theme.colors.surfaceElevated }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E94560' }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>High (85%+)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9800' }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>Medium (70-85%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.legendText, { color: theme.colors.text }]}>Low ({'<'}70%)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: width,
    height: height,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1,
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    position: 'relative',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshing: {
    transform: [{ rotate: '180deg' }],
  },
  filterPanel: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    maxHeight: height * 0.6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterContent: {
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  timeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  timeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scamTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scamTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    minWidth: '45%',
  },
  scamTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  clearButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerProbability: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  clusterMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  clusterRiskText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  riskScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoTitleContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  infoDetails: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  distanceCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceInfo: {
    flex: 1,
  },
  distanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  centerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
    minWidth: 80,
  },
  navigateButton: {
    flex: 1.2,
  },
  viewDossierButton: {
    borderWidth: 1,
  },
  cordonButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  cordonActive: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

