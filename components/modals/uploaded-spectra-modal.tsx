import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useThemeColor } from '../../hooks/use-theme-color';
import { UploadedSpectrum } from '../../lib/types';
import {
  parseSpectrumFile,
  extractSpectrumName,
  convertToSpectrumData,
} from '../../lib/spectrum-parser';
import { ThemedText } from '../themed-text';

interface UploadedSpectraModalProps {
  visible: boolean;
  onClose: () => void;
  uploadedSpectra: UploadedSpectrum[];
  onUploadedSpectraChange: (spectra: UploadedSpectrum[]) => void;
}

export function UploadedSpectraModal({
  visible,
  onClose,
  uploadedSpectra,
  onUploadedSpectraChange,
}: UploadedSpectraModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<'absorption' | 'emission'>('absorption');

  useEffect(() => {
    if (!visible) {
      setEditingIndex(null);
      setEditingName('');
      setEditingType('absorption');
    }
  }, [visible]);

  const handleFileUpload = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv,.tsx';
        input.onchange = async (e: Event) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) return;

          try {
            const text = await file.text();
            await processFile(text, file.name);
          } catch (error) {
            console.error('Error reading file:', error);
            alert('Failed to read file. Please try again.');
          }
        };
        input.click();
      } else {
        // Mobile - try to use expo-document-picker if available
        try {
          // Dynamic import to avoid errors if package is not installed
          const DocumentPicker = require('expo-document-picker');
          const result = await DocumentPicker.getDocumentAsync({
            type: ['text/plain', 'text/csv', 'application/octet-stream'],
            copyToCacheDirectory: true,
          });

          if (result.canceled) return;

          const file = result.assets[0];
          if (!file) return;

          // Read file content
          const response = await fetch(file.uri);
          const text = await response.text();
          await processFile(text, file.name || 'spectrum.txt');
        } catch (error: any) {
          // If expo-document-picker is not available, show helpful message
          if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('expo-document-picker')) {
            Alert.alert(
              'File Upload',
              'File upload on mobile requires expo-document-picker.\n\nPlease install it:\nnpm install expo-document-picker',
              [{ text: 'OK' }]
            );
          } else {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick file. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      if (Platform.OS === 'web') {
        alert('Failed to upload file. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to upload file. Please try again.');
      }
    }
  };

  const processFile = async (content: string, filename: string) => {
    try {
      // Parse the file
      const parsedData = parseSpectrumFile(content, filename);
      
      // Extract name from filename
      const defaultName = extractSpectrumName(filename);
      
      // Prompt for name and type
      if (Platform.OS === 'web') {
        const name = prompt('Enter a name for this spectrum:', defaultName) || defaultName;
        const typeInput = prompt('Enter spectrum type (absorption/emission):', 'absorption')?.toLowerCase();
        const type = (typeInput === 'emission' ? 'emission' : 'absorption') as 'absorption' | 'emission';
        
        if (name) {
          addSpectrum(name, type, parsedData, filename);
        }
      } else {
        // For mobile, add with default name and let user edit
        // Try to infer type from filename
        const lowerFilename = filename.toLowerCase();
        const inferredType = (lowerFilename.includes('emission') || lowerFilename.includes('em'))
          ? 'emission'
          : 'absorption';
        addSpectrum(defaultName, inferredType, parsedData, filename);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse file';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const addSpectrum = (
    name: string,
    type: 'absorption' | 'emission',
    parsedData: Array<{ wavelength: number; value: number }>,
    fileName?: string
  ) => {
    const id = `uploaded-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const spectrumData = convertToSpectrumData(parsedData, id, type);
    
    const newSpectrum: UploadedSpectrum = {
      id,
      name,
      type,
      data: spectrumData,
      fileName,
    };

    onUploadedSpectraChange([...uploadedSpectra, newSpectrum]);
  };

  const handleEdit = (index: number) => {
    const spectrum = uploadedSpectra[index];
    setEditingIndex(index);
    setEditingName(spectrum.name);
    setEditingType(spectrum.type);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    
    const updated = [...uploadedSpectra];
    updated[editingIndex] = {
      ...updated[editingIndex],
      name: editingName,
      type: editingType,
    };
    
    onUploadedSpectraChange(updated);
    setEditingIndex(null);
    setEditingName('');
  };

  const handleDelete = (index: number) => {
    onUploadedSpectraChange(uploadedSpectra.filter((_, i) => i !== index));
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
          onPress={() => {}}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Upload spectrum
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Upload button */}
            <View style={styles.section}>
              <Pressable
                style={[styles.uploadButton, { backgroundColor: tintColor, borderColor: tintColor }]}
                onPress={handleFileUpload}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={primaryButtonTextColor} />
                <ThemedText style={[styles.uploadButtonText, { color: primaryButtonTextColor }]}>
                  Upload Spectrum File
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.hint}>
                Supported formats: TXT, CSV, TSX (tab or comma separated)
              </ThemedText>
            </View>

            {/* Current list */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Uploaded spectra {uploadedSpectra.length > 0 && `(${uploadedSpectra.length})`}
              </ThemedText>
              {uploadedSpectra.length === 0 ? (
                <ThemedText style={styles.muted}>No spectra uploaded yet.</ThemedText>
              ) : (
                <View style={styles.list}>
                  {uploadedSpectra.map((spectrum, i) => (
                    <View key={spectrum.id} style={[styles.listItem, { borderColor }]}>
                      {editingIndex === i ? (
                        <View style={styles.editForm}>
                          <TextInput
                            style={[styles.nameInput, { borderColor, color: textColor, backgroundColor: inputBg }]}
                            value={editingName}
                            onChangeText={setEditingName}
                            placeholder="Spectrum name"
                            placeholderTextColor={iconColor}
                          />
                          <View style={styles.typeRow}>
                            <Pressable
                              style={[
                                styles.typeChip,
                                { borderColor },
                                editingType === 'absorption' && { backgroundColor: tintColor, borderColor: tintColor },
                              ]}
                              onPress={() => setEditingType('absorption')}
                            >
                              <ThemedText
                                style={[
                                  styles.typeChipText,
                                  editingType === 'absorption' && { color: primaryButtonTextColor },
                                ]}
                              >
                                Absorption
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.typeChip,
                                { borderColor },
                                editingType === 'emission' && { backgroundColor: tintColor, borderColor: tintColor },
                              ]}
                              onPress={() => setEditingType('emission')}
                            >
                              <ThemedText
                                style={[
                                  styles.typeChipText,
                                  editingType === 'emission' && { color: primaryButtonTextColor },
                                ]}
                              >
                                Emission
                              </ThemedText>
                            </Pressable>
                          </View>
                          <View style={styles.editActions}>
                            <Pressable
                              style={[styles.saveBtn, { backgroundColor: tintColor }]}
                              onPress={handleSaveEdit}
                            >
                              <ThemedText style={[styles.saveBtnText, { color: primaryButtonTextColor }]}>
                                Save
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              style={[styles.cancelBtn, { borderColor }]}
                              onPress={handleCancelEdit}
                            >
                              <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <View style={styles.listItemContent}>
                            <ThemedText style={styles.listItemLabel} numberOfLines={1} ellipsizeMode="tail">
                              {spectrum.fileName ?? spectrum.name} • {spectrum.data.length} data points
                            </ThemedText>
                          </View>
                          <View style={styles.listItemActions}>
                            <Pressable
                              style={[styles.smBtn, { borderColor }]}
                              onPress={() => handleEdit(i)}
                            >
                              <ThemedText style={styles.smBtnText}>Edit</ThemedText>
                            </Pressable>
                            <Pressable
                              style={[styles.smBtn, { borderColor }]}
                              onPress={() => handleDelete(i)}
                            >
                              <Ionicons name="close" size={16} color={textColor} />
                            </Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Pressable style={[styles.closeBtn, { borderColor: tintColor }]} onPress={onClose}>
              <ThemedText style={[styles.closeBtnText, { color: tintColor }]}>Close</ThemedText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 12, minWidth: 0 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  muted: { fontSize: 13, opacity: 0.7 },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadButtonText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.7, textAlign: 'center' },
  list: { flexDirection: 'column', gap: 8, minWidth: 0 },
  listItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  listItemContent: {
    flex: 1,
    minWidth: 0,
  },
  listItemLabel: { fontSize: 14, fontWeight: '600', minWidth: 0 },
  listItemActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smBtnText: { fontSize: 13, fontWeight: '600' },
  editForm: {
    gap: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '600' },
  cancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '500' },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' },
});
