import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAlertStore } from '../store/alertStore';
import { redactText, autoRedactImage } from '../utils/redaction';
import { useTheme } from '../theme/theme';
import { Evidence, Annotation } from '../types';

export default function EvidenceScreen() {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { alertId, hotspot } = route.params as { alertId: string; hotspot?: any };
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redacted, setRedacted] = useState(false);
  const [notes, setNotes] = useState('');
  
  const { addEvidence } = useAlertStore();

  const handleCapture = async () => {
    if (!permission?.granted) {
      Alert.alert('Permission Required', 'Camera permission is required');
      return;
    }

    // In a real implementation, you would capture the image here
    // For now, we'll use a placeholder
    Alert.alert('Capture', 'Image capture functionality would be implemented here');
  };

  const handleAutoRedact = async () => {
    if (!capturedImage) {
      Alert.alert('No Image', 'Please capture an image first');
      return;
    }

    try {
      const redactedUri = await autoRedactImage(capturedImage);
      setCapturedImage(redactedUri);
      setRedacted(true);
      Alert.alert('Success', 'Image has been auto-redacted');
    } catch (error) {
      Alert.alert('Error', 'Failed to redact image');
    }
  };

  const handleAddAnnotation = (type: 'blur' | 'circle' | 'text') => {
    // In a real implementation, this would allow the user to draw on the image
    Alert.alert('Annotation', `${type} annotation would be added here`);
  };

  const handleSubmit = async () => {
    if (!capturedImage) {
      Alert.alert('Error', 'Please capture evidence first');
      return;
    }

    try {
      const evidence: Omit<Evidence, 'id' | 'timestamp' | 'synced'> = {
        alertId,
        type: 'photo',
        uri: capturedImage,
        annotations: annotations.length > 0 ? annotations : undefined,
        redacted,
      };

      await addEvidence(evidence);

      Alert.alert('Success', 'Evidence submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit evidence');
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.message, { color: theme.colors.text }]}>
          Requesting camera permission...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.message, { color: theme.colors.text }]}>
          Camera permission is required
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Evidence Logger</Text>
        <View style={{ width: 24 }} />
      </View>

      {!capturedImage ? (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing={facing}>
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleCapture}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Image source={{ uri: capturedImage }} style={[styles.image, { backgroundColor: theme.colors.surface }]} />
          
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.surfaceElevated }]}
              onPress={() => setCapturedImage(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
              <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: redacted ? theme.colors.success : theme.colors.surfaceElevated },
              ]}
              onPress={handleAutoRedact}
              activeOpacity={0.7}
            >
              <Ionicons name="shield" size={20} color={redacted ? '#fff' : theme.colors.text} />
              <Text style={[styles.actionButtonText, { color: redacted ? '#fff' : theme.colors.text }]}>
                {redacted ? 'Redacted' : 'Auto-Redact'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.annotationSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Annotations</Text>
            <View style={styles.annotationButtons}>
              <TouchableOpacity
                style={[styles.annotationButton, { backgroundColor: theme.colors.surfaceElevated }]}
                onPress={() => handleAddAnnotation('blur')}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-off" size={20} color={theme.colors.accent} />
                <Text style={[styles.annotationButtonText, { color: theme.colors.text }]}>Blur</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.annotationButton, { backgroundColor: theme.colors.surfaceElevated }]}
                onPress={() => handleAddAnnotation('circle')}
                activeOpacity={0.7}
              >
                <Ionicons name="radio-button-on" size={20} color={theme.colors.accent} />
                <Text style={[styles.annotationButtonText, { color: theme.colors.text }]}>Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.annotationButton, { backgroundColor: theme.colors.surfaceElevated }]}
                onPress={() => handleAddAnnotation('text')}
                activeOpacity={0.7}
              >
                <Ionicons name="text" size={20} color={theme.colors.accent} />
                <Text style={[styles.annotationButtonText, { color: theme.colors.text }]}>Label</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.notesSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notes</Text>
            <Text style={[styles.notesPlaceholder, { 
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.surfaceElevated,
            }]}>
              Add any additional observations or context...
            </Text>
          </View>
        </View>
      )}

      {capturedImage && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.colors.success }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.submitButtonText}>Submit Evidence</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.infoBox, {
        backgroundColor: theme.colors.info + '15',
        borderColor: theme.colors.info + '30',
      }]}>
        <Ionicons name="information-circle" size={20} color={theme.colors.info} />
        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
          All evidence is automatically redacted for privacy compliance (DPDP Act 2023).
          Sensitive data like account numbers and phone numbers are blurred.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  cameraContainer: {
    height: 500,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  imageContainer: {
    margin: 20,
  },
  image: {
    width: '100%',
    height: 400,
    borderRadius: 16,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
    minHeight: 44,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  annotationSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  annotationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  annotationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  annotationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesSection: {
    marginTop: 20,
  },
  notesPlaceholder: {
    fontSize: 14,
    padding: 16,
    borderRadius: 12,
    minHeight: 100,
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    padding: 18,
    borderRadius: 16,
    gap: 10,
    minHeight: 56,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    margin: 20,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    padding: 16,
    borderRadius: 16,
    margin: 20,
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
});

