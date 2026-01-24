import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addStopwatchRecord, getStopwatchRecords } from '../db/stopwatchDB';

export default function Focus() {
  const [name, setName] = useState('');
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [records, setRecords] = useState([]);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

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
  };

  const toggleTimer = () => {
    if (running) {
      stop();
    } else {
      start();
    }
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

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.timerSection}>
        <Text style={styles.title}>{name ? name : 'Focus'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Name your stopwatch"
          value={name}
          onChangeText={setName}
        />
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
            <View key={record.id} style={styles.recordBlock}>
              <Text style={styles.recordName}>{record.name}</Text>
              <Text style={styles.recordTime}>{formatTime(record.duration_ms)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
});
