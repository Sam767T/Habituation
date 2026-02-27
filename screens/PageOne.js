import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getHabits, logHabit, getHabitLogForDate, getAllHabitLogsForDate } from '../db/habitDB';

export default function PageOne() {
  const [habits, setHabits] = useState([]);
  const [positiveHabits, setPositiveHabits] = useState([]);
  const [negativeHabits, setNegativeHabits] = useState([]);
  const [todayLogs, setTodayLogs] = useState({});
  const [yesterdayLogs, setYesterdayLogs] = useState({});

  useEffect(() => {
    initializeData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const initializeData = async () => {
    await loadData();
  };

  const formatDateKey = (date) => {
    const pad2 = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };

  const loadData = async () => {
    try {
      const allHabits = await getHabits();
      setHabits(allHabits);
      
      const positive = allHabits.filter(h => h.type === 'positive');
      const negative = allHabits.filter(h => h.type === 'negative');
      setPositiveHabits(positive);
      setNegativeHabits(negative);

      // Load today's logs
      const today = formatDateKey(new Date());
      const todayData = await getAllHabitLogsForDate(today);
      const todayMap = {};
      todayData.forEach(log => {
        todayMap[log.habit_id] = log.completed === 1;
      });
      setTodayLogs(todayMap);

      // Load yesterday's logs
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateKey(yesterday);
      const yesterdayData = await getAllHabitLogsForDate(yesterdayStr);
      const yesterdayMap = {};
      yesterdayData.forEach(log => {
        yesterdayMap[log.habit_id] = log.completed === 1;
      });
      setYesterdayLogs(yesterdayMap);
    } catch (error) {
      console.error('Failed to load habits:', error);
    }
  };

  const handlePositiveHabitLog = async (habitId) => {
    try {
      const today = formatDateKey(new Date());
      const currentStatus = todayLogs[habitId] || false;
      const willBeLogged = !currentStatus;
      
      // Only show celebration if logging (not unlogging)
      if (willBeLogged) {
        // Celebratory haptics
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise(resolve => setTimeout(resolve, 80));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      await logHabit(habitId, today, willBeLogged);
      await loadData();
    } catch (error) {
      console.error('Failed to log habit:', error);
      Alert.alert('Error', 'Failed to log habit');
    }
  };

  const handleNegativeHabitLog = async (habitId) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateKey(yesterday);
      const currentStatus = yesterdayLogs[habitId] || false;
      const willBeLogged = !currentStatus;
      
      // Only show celebration if logging (not unlogging)
      if (willBeLogged) {
        // Celebratory haptics
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await new Promise(resolve => setTimeout(resolve, 80));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      
      await logHabit(habitId, yesterdayStr, willBeLogged);
      await loadData();
    } catch (error) {
      console.error('Failed to log habit:', error);
      Alert.alert('Error', 'Failed to log habit');
    }
  };

  const renderPositiveHabit = (habit) => {
    const isLogged = todayLogs[habit.id] || false;
    return (
      <Pressable
        key={habit.id}
        style={[styles.habitCard, styles.positiveCard, isLogged && styles.habitCardCompleted]}
        onPress={() => handlePositiveHabitLog(habit.id)}
      >
        <View style={styles.habitCardContent}>
          <Text style={[styles.habitName, isLogged && styles.habitNameCompleted]}>
            {habit.name}
          </Text>
          <View style={styles.checkmarkPlaceholder}>
            {isLogged && (
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderNegativeHabit = (habit) => {
    const isLogged = yesterdayLogs[habit.id] || false;
    return (
      <Pressable
        key={habit.id}
        style={[styles.habitCard, styles.negativeCard, isLogged && styles.habitCardCompleted]}
        onPress={() => handleNegativeHabitLog(habit.id)}
      >
        <View style={styles.habitCardContent}>
          <Text style={[styles.habitName, isLogged && styles.habitNameCompleted]}>
            {habit.name}
          </Text>
          <View style={styles.checkmarkPlaceholder}>
            {isLogged && (
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            )}
          </View>
        </View>
        <Text style={styles.habitSubtext}>Did you abstain yesterday?</Text>
      </Pressable>
    );
  };

  const formatDate = () => {
    const today = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return today.toLocaleDateString('en-US', options);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollContainer} stickyHeaderIndices={[0]}>
        <View style={styles.header}>
          <Text style={styles.headerDate}>{formatDate()}</Text>
          <Text style={styles.headerTitle}>Log Habits</Text>
        </View>

        {positiveHabits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-up" size={20} color="#34C759" />
              <Text style={styles.sectionTitle}>Positive Habits</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Log your progress today</Text>
            {positiveHabits.map(renderPositiveHabit)}
          </View>
        )}

        {negativeHabits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trending-down" size={20} color="#FF3B30" />
              <Text style={styles.sectionTitle}>Negative Habits</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Check yesterday's abstinence</Text>
            {negativeHabits.map(renderNegativeHabit)}
          </View>
        )}

        {habits.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="add-circle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No habits yet</Text>
            <Text style={styles.emptySubtext}>Go to Manage Habits to add some</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
    color: '#000',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  habitCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  positiveCard: {
    borderLeftColor: '#34C759',
  },
  negativeCard: {
    borderLeftColor: '#FF3B30',
  },
  habitCardCompleted: {
    backgroundColor: '#f0f9f4',
  },
  habitCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkmarkPlaceholder: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  habitNameCompleted: {
    color: '#666',
  },
  habitSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
});
