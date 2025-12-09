import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/store/authStore';
import { syncManager } from './src/services/syncManager';
import { ThemeProvider, useTheme } from './src/theme/theme';
import ErrorBoundary from './src/components/ErrorBoundary';
import * as SecureStore from 'expo-secure-store';

// Screens
import NextGenLEADashboard from './src/screens/NextGenLEADashboard';
import MapScreen from './src/screens/MapScreen';
import RiskHeatmapScreen from './src/screens/RiskHeatmapScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AdvancedReportScreen from './src/screens/AdvancedReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import SplashScreen from './src/screens/SplashScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import CaseDetailScreen from './src/screens/CaseDetailScreen';
import MuleAccountsScreen from './src/screens/MuleAccountsScreen';
import FreezeConfirmationScreen from './src/screens/FreezeConfirmationScreen';
import SingleFreezeScreen from './src/screens/SingleFreezeScreen';
import NewComplaintAlertScreen from './src/screens/NewComplaintAlertScreen';
import ARScreen from './src/screens/ARScreen';
import EvidenceScreen from './src/screens/EvidenceScreen';
import PredictiveAnalyticsDashboard from './src/screens/PredictiveAnalyticsDashboard';
import PredictionExplanationScreen from './src/screens/PredictionExplanationScreen';
import SecurityDashboardScreen from './src/screens/SecurityDashboardScreen';
import ComplianceDashboardScreen from './src/screens/ComplianceDashboardScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import PermissionRequestScreen from './src/screens/PermissionRequestScreen';
import AdminFLStatusScreen from './src/screens/AdminFLStatusScreen';
import AdminRLStatusScreen from './src/screens/AdminRLStatusScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import NCRPPortalScreen from './src/screens/NCRPPortalScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AdminAuthScreen from './src/screens/AdminAuthScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'shield' : 'shield-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Stats') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 0.5,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="Alerts" 
        component={AlertsScreen}
        options={{ title: 'Alerts' }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapScreen}
        options={{ title: 'Map' }}
      />
      <Tab.Screen 
        name="Stats" 
        component={require('./src/screens/StatisticsScreen').default}
        options={{ title: 'Stats' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={SettingsScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Admin Tabs Navigator
function AdminTabs() {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'AdminHome') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'FLStatus') {
            iconName = focused ? 'git-network' : 'git-network-outline';
          } else if (route.name === 'RLStatus') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'AdminSettings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: theme.colors.textTertiary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 0.5,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
      })}
    >
      <Tab.Screen 
        name="AdminHome" 
        component={AdminDashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="FLStatus" 
        component={AdminFLStatusScreen}
        options={{ title: 'FL Models' }}
      />
      <Tab.Screen 
        name="RLStatus" 
        component={AdminRLStatusScreen}
        options={{ title: 'RL Models' }}
      />
      <Tab.Screen 
        name="AdminSettings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading, checkAuth, userRole } = useAuthStore();
  const [showSplash, setShowSplash] = React.useState(true);
  const [showPermissions, setShowPermissions] = React.useState(false);
  const [checkingPermissions, setCheckingPermissions] = React.useState(true);

  useEffect(() => {
    checkAuth();
    checkPermissionsStatus();
    // Register background sync
    syncManager.register();
    
    // Show splash for 2 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    
    return () => {
      syncManager.unregister();
      clearTimeout(splashTimer);
    };
  }, []);

  const checkPermissionsStatus = async () => {
    try {
      const permissionsRequested = await SecureStore.getItemAsync('permissions_requested');
      if (!permissionsRequested && isAuthenticated) {
        setShowPermissions(true);
      } else {
        setShowPermissions(false);
      }
    } catch (error) {
      console.error('Error checking permissions status:', error);
      setShowPermissions(false);
    } finally {
      setCheckingPermissions(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isLoading && !showSplash) {
      checkPermissionsStatus();
    }
  }, [isAuthenticated, isLoading, showSplash]);

  if (isLoading || showSplash || checkingPermissions) {
    return <SplashScreen />;
  }

  // Not authenticated - show welcome/auth screens
  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="OfficerAuth" component={AuthScreen} />
        <Stack.Screen name="AdminAuth" component={AdminAuthScreen} />
        <Stack.Screen name="NCRPPortal" component={NCRPPortalScreen} />
      </Stack.Navigator>
    );
  }

  // Show permission request screen if not yet requested (for officers)
  if (showPermissions && userRole === 'officer') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PermissionRequest" component={PermissionRequestScreen} />
        <Stack.Screen 
          name="MainTabs" 
          component={MainTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }

  // Admin flow
  if (userRole === 'admin') {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        }}
      >
        <Stack.Screen 
          name="AdminMain" 
          component={AdminTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="AdminFLStatus" 
          component={AdminFLStatusScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="AdminRLStatus" 
          component={AdminRLStatusScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="CaseDetail" 
          component={CaseDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="CaseReport" 
          component={require('./src/screens/CaseReportScreen').default}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }

  // Officer flow (default)
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AlertDetail" 
        component={CaseDetailScreen}
        options={{ 
          title: 'Case Details',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CaseDetail" 
        component={CaseDetailScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MuleAccounts" 
        component={MuleAccountsScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="FreezeConfirmation" 
        component={FreezeConfirmationScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="SingleFreeze" 
        component={SingleFreezeScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="TeamStatus" 
        component={require('./src/screens/TeamStatusScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="OutcomeFeedback" 
        component={require('./src/screens/OutcomeFeedbackScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MoneyTrail" 
        component={require('./src/screens/MoneyTrailScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CaseSuccess" 
        component={require('./src/screens/CaseSuccessScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AR" 
        component={ARScreen}
        options={{ 
          title: 'AR Field View',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Evidence" 
        component={EvidenceScreen}
        options={{ 
          title: 'Evidence Logger',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="PredictiveAnalytics" 
        component={PredictiveAnalyticsDashboard}
        options={{ 
          title: 'AI Analytics',
        }}
      />
      <Stack.Screen 
        name="PredictionExplanation" 
        component={PredictionExplanationScreen}
        options={{ 
          title: 'AI Explanation',
        }}
      />
      <Stack.Screen 
        name="AdvancedReport" 
        component={AdvancedReportScreen}
        options={{ 
          title: 'Report Fraud',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="SecurityDashboard" 
        component={SecurityDashboardScreen}
        options={{ 
          title: 'Security & Compliance',
        }}
      />
      <Stack.Screen 
        name="AuditLogViewer" 
        component={require('./src/screens/AuditLogViewerScreen').default}
        options={{ 
          title: 'Audit Logs',
        }}
      />
      <Stack.Screen 
        name="ComplianceReports" 
        component={ComplianceDashboardScreen}
        options={{ 
          title: 'Compliance Dashboard',
        }}
      />
      <Stack.Screen 
        name="Map" 
        component={MapScreen}
        options={{ 
          title: 'Hotspot Map',
        }}
      />
      <Stack.Screen 
        name="SuspectNetwork" 
        component={require('./src/screens/SuspectNetworkScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MuleNetwork" 
        component={require('./src/screens/MuleNetworkScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="FreezeAllNodes" 
        component={require('./src/screens/FreezeAllNodesScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AIAnalysis" 
        component={require('./src/screens/AIAnalysisScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CaseReport" 
        component={require('./src/screens/CaseReportScreen').default}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AdminFLStatus" 
        component={AdminFLStatusScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AdminRLStatus" 
        component={AdminRLStatusScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="NCRPPortal" 
        component={NCRPPortalScreen}
        options={{ 
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

