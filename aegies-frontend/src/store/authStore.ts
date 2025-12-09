import { create } from 'zustand';
import { User } from '../types';
import { secureStorage } from '../services/secureStorage';
import { authService } from '../api/authService';

export type UserRole = 'officer' | 'admin' | 'citizen';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  userRole: UserRole | null;
  
  login: (badgeId: string, password: string, department?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  enableBiometric: (enabled: boolean) => Promise<void>;
  setUser: (user: User) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUserRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,
  userRole: null,

  setUser: (user) => set({ user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setUserRole: (role) => set({ userRole: role }),

  login: async (badgeId, password, department) => {
    try {
      // Use the new API authService (username is badgeId)
      const result = await authService.login(badgeId, password);

      if (result.success && result.data) {
        const loginData = result.data;
        const user: User = {
          id: loginData.officer.id,
          email: `${loginData.officer.badge_id.toLowerCase().replace(/-/g, '')}@mhpolice.gov.in`,
          name: loginData.officer.name,
          type: 'lea',
          organization: department || 'Maharashtra Cyber Cell',
          badgeNumber: loginData.officer.badge_id,
          rank: loginData.officer.rank,
        };

        // Store user data and department in secure storage for persistence
        await secureStorage.setUser(user);
        await secureStorage.setDepartment(department || 'Maharashtra Cyber Cell');
        await secureStorage.setBadgeId(badgeId);
        
        // Set authentication state with officer role
        set({ user, isAuthenticated: true, userRole: 'officer' });
        return { success: true };
      }

      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  logout: async () => {
    try {
      // Call API logout
      await authService.logout();
    } catch (error) {
      console.warn('Logout API call failed, clearing local session:', error);
    } finally {
      // Always clear local storage
      await secureStorage.clear();
      set({ user: null, isAuthenticated: false, biometricEnabled: false, userRole: null });
      
      // Navigation will be handled by App.tsx based on isAuthenticated state
      // The AppNavigator will automatically show WelcomeScreen when isAuthenticated is false
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      // Check if token exists
      const token = await secureStorage.getToken();
      const user = await secureStorage.getUser();
      
      if (token && user) {
        // Verify token is still valid by checking with API
        try {
          const currentUser = await authService.getCurrentUser();
          if (currentUser.success && currentUser.data) {
            // Token is valid, update user data if needed
            const updatedUser: User = {
              id: currentUser.data.id,
              email: currentUser.data.email,
              name: currentUser.data.name,
              type: 'lea',
              organization: user.organization || 'Maharashtra Cyber Cell',
              badgeNumber: currentUser.data.badge_id,
              rank: currentUser.data.rank,
            };
            await secureStorage.setUser(updatedUser);
            set({ user: updatedUser, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch (error) {
          // If API call fails, still use stored user if token exists
          // This allows offline access
          console.warn('Could not verify token with API, using stored session:', error);
          set({ user, isAuthenticated: true, isLoading: false });
          return;
        }
      }
      
      // No valid session found
      set({ isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Error checking auth:', error);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  enableBiometric: async (enabled) => {
    await secureStorage.setBiometricEnabled(enabled);
    set({ biometricEnabled: enabled });
  },
}));

