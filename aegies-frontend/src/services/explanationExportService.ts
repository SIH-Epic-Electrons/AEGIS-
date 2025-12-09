/**
 * Explanation Export Service
 * Exports explanations to PDF, JSON, etc.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export interface ExplanationData {
  complaintId: string;
  explanation: any;
  prediction: any;
  timestamp: string;
}

/**
 * Export explanation to JSON
 */
export const exportToJSON = async (data: ExplanationData): Promise<string | null> => {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    const fileName = `explanation_${data.complaintId}_${Date.now()}.json`;
    const docDir = (FileSystem as any).documentDirectory || '';
    const fileUri = `${docDir}${fileName}`;
    
    await FileSystem.writeAsStringAsync(fileUri, jsonData);
    
    return fileUri;
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    Alert.alert('Export Failed', 'Could not export explanation to JSON');
    return null;
  }
};

/**
 * Share explanation
 */
export const shareExplanation = async (data: ExplanationData): Promise<void> => {
  try {
    // Export to JSON first
    const fileUri = await exportToJSON(data);
    
    if (!fileUri) {
      return;
    }
    
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Share Explanation',
      });
    } else {
      Alert.alert('Sharing Not Available', 'Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing explanation:', error);
    Alert.alert('Share Failed', 'Could not share explanation');
  }
};

/**
 * Generate report text
 */
export const generateReport = (data: ExplanationData): string => {
  const { complaintId, explanation, prediction } = data;
  
  let report = `AEGIS Prediction Explanation Report\n`;
  report += `Complaint ID: ${complaintId}\n`;
  report += `Generated: ${new Date(data.timestamp).toLocaleString()}\n\n`;
  
  report += `Prediction Summary:\n`;
  report += `Risk Score: ${(prediction.riskScore * 100).toFixed(1)}%\n`;
  report += `Hotspots: ${prediction.hotspots?.length || 0}\n\n`;
  
  if (explanation.topFactors) {
    report += `Top Contributing Factors:\n`;
    explanation.topFactors.slice(0, 5).forEach((factor: any, index: number) => {
      report += `${index + 1}. ${factor.feature}: ${(factor.contribution * 100).toFixed(1)}%\n`;
    });
  }
  
  if (explanation.trust_score) {
    report += `\nTrust Score: ${(explanation.trust_score.trust_score * 100).toFixed(0)}%\n`;
    report += `${explanation.trust_score.explanation}\n`;
  }
  
  return report;
};

