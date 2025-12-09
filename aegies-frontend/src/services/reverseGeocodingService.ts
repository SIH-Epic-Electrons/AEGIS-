/**
 * Reverse Geocoding Service
 * Converts coordinates (lat/lon) to human-readable addresses
 */

import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { secureStorage } from './secureStorage';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ReverseGeocodeResult {
  formatted_address: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postcode?: string;
  district?: string;
  neighborhood?: string;
  road?: string;
  latitude: number;
  longitude: number;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const reverseGeocodingService = {
  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(
    lat: number,
    lon: number
  ): Promise<ServiceResponse<ReverseGeocodeResult>> {
    try {
      const response = await api.get<{ success: boolean; data: ReverseGeocodeResult }>(
        `/atms/reverse-geocode`,
        {
          params: { lat, lon },
        }
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      // Fallback: Try using browser geocoding API if available
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          // Use a simple fallback - construct approximate address from coordinates
          // In production, use a proper geocoding service
          const approximateAddress = await this._approximateAddressFromCoords(lat, lon);
          return {
            success: true,
            data: approximateAddress,
          };
        } catch (fallbackError) {
          console.warn('Fallback geocoding failed:', fallbackError);
        }
      }

      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to reverse geocode',
      };
    }
  },

  /**
   * Approximate address from coordinates (fallback)
   * Uses known Indian cities database
   */
  async _approximateAddressFromCoords(
    lat: number,
    lon: number
  ): Promise<ReverseGeocodeResult> {
    // Major Indian cities with approximate coordinates
    const cities = [
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777, state: 'Maharashtra' },
      { name: 'Delhi', lat: 28.6139, lon: 77.2090, state: 'Delhi' },
      { name: 'Bangalore', lat: 12.9716, lon: 77.5946, state: 'Karnataka' },
      { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, state: 'Telangana' },
      { name: 'Chennai', lat: 13.0827, lon: 80.2707, state: 'Tamil Nadu' },
      { name: 'Kolkata', lat: 22.5726, lon: 88.3639, state: 'West Bengal' },
      { name: 'Pune', lat: 18.5204, lon: 73.8567, state: 'Maharashtra' },
      { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, state: 'Gujarat' },
      { name: 'Jaipur', lat: 26.9124, lon: 75.7873, state: 'Rajasthan' },
      { name: 'Surat', lat: 21.1702, lon: 72.8311, state: 'Gujarat' },
      { name: 'Thane', lat: 19.2183, lon: 72.9781, state: 'Maharashtra' },
      { name: 'Nashik', lat: 19.9975, lon: 73.7898, state: 'Maharashtra' },
    ];

    // Find nearest city
    let nearestCity = cities[0];
    let minDistance = Infinity;

    for (const city of cities) {
      const distance = Math.sqrt(
        Math.pow(lat - city.lat, 2) + Math.pow(lon - city.lon, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    }

    return {
      formatted_address: `${nearestCity.name}, ${nearestCity.state}, India`,
      address: `${nearestCity.name}, ${nearestCity.state}`,
      city: nearestCity.name,
      state: nearestCity.state,
      country: 'India',
      latitude: lat,
      longitude: lon,
    };
  },
};

