import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { deleteStopwatchRecord, addStopwatchRecord, getStopwatchRecords } from '../db/stopwatchDB';

export default function Focus() {
  const [name, setName] = useState('');
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [records, setRecords] = useState([]);
  const [customSuggestions, setCustomSuggestions] = useState([]);
  const startRef = useRef(null);
  const intervalRef = useRef(null);
  const defaultSuggestions = ['Read', 'Write', 'Focus', 'Exercise'];

  useEffect(() => {
    loadRecords();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
    }, [])
  );

  const loadRecords = async () => {
    try {
      const data = await getStopwatchRecords();
      setRecords(data);
      // Extract unique activity names from records
      const uniqueNames = [...new Set(data.map(record => record.name).filter(name => name && !defaultSuggestions.includes(name)))];
      setCustomSuggestions(uniqueNames);
    } catch (error) {
      console.error('Failed to load records:', error);
    }
  };

  useEffect(() => {
    if (running) {
      startRef.current = startRef.current ?? Date.now();
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current);
      }, 50);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const start = () => {
    if (running) return;
    startRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  };

  const stop = async () => {
    if (!running) return;
    setRunning(false);
    // Save to database
    try {
      await addStopwatchRecord(name, elapsedMs);
      await loadRecords();
    } catch (error) {
      console.error('Failed to save record:', error);
    }
    setElapsedMs(0);
    setName('');
  };

  const toggleTimer = () => {
    if (running) {
      stop();
    } else {
      start();
    }
  };

  const handleDeleteRecord = async (id) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStopwatchRecord(id);
              await loadRecords();
            } catch (error) {
              console.error('Failed to delete record:', error);
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (recordId) => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => handleDeleteRecord(recordId)}
    >
      <Ionicons name="trash" size={24} color="#333" />
    </Pressable>
  );

  const renderSuggestions = () => {
    const allSuggestions = [...defaultSuggestions, ...customSuggestions];
    return allSuggestions.map((suggestion) => (
      <Pressable
        key={suggestion}
        style={styles.suggestionButton}
        onPress={() => setName(suggestion)}
      >
        <Text style={styles.suggestionText}>{suggestion}</Text>
      </Pressable>
    ));
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    const pad2 = (n) => String(n).padStart(2, '0');
    const main = hours > 0
      ? `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(minutes)}:${pad2(seconds)}`;
    return `${main}.${pad2(centiseconds)}`;
  };

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} at ${hours}:${minutes}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollContainer}>
      <View style={styles.timerSection}>
        <View style={styles.suggestionsContainer}>
          {renderSuggestions()}
        </View>
        {running ? (
          <Text style={styles.activityText}>{name || 'Activity'}</Text>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Activity"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            maxLength={20}
            cursorColor="#007AFF"
            autoFocus={false}
            caretHidden={false}
          />
        )}
        <Text style={styles.time}>{formatTime(elapsedMs)}</Text>
        <Pressable style={styles.iconButton} onPress={toggleTimer}>
          <Ionicons
            name={running ? 'stop-circle' : 'play-circle'}
            size={64}
            color="#007AFF"
          />
        </Pressable>
      </View>

      <View style={styles.recordsSection}>
        <Text style={styles.recordsTitle}>Recent Sessions</Text>
        {records.length === 0 ? (
          <Text style={styles.noRecords}>No sessions yet</Text>
        ) : (
          records.map((record) => (
            <Swipeable
              key={record.id}
              renderRightActions={() => renderRightActions(record.id)}
            >
              <View style={styles.recordBlock}>
                <Text style={styles.recordName}>{record.name}</Text>
                <Text style={styles.recordTime}>{formatTime(record.duration_ms)} - {formatDateTime(record.created_at)}</Text>
              </View>
            </Swipeable>
          ))
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  timerSection: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
    width: '80%',
    alignSelf: 'center',
  },
  suggestionButton: {
    backgroundColor: '#E8E8E8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  input: {
    minWidth: 80,
    maxWidth: 250,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 16,
    fontSize: 28,
    textAlign: 'center',
  },
  activityText: {
    fontSize: 28,
    color: '#333',
    marginBottom: 16,
  },
  time: {
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  iconButton: {
    padding: 8,
  },
  recordsSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  recordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noRecords: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginVertical: 12,
  },
  recordBlock: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  recordName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordTime: {
    fontSize: 12,
    color: '#666',
    fontVariant: ['tabular-nums'],
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
