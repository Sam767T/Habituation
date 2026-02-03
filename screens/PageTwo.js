import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { getHabits, addHabit, deleteHabit, getHabitStats, getHabitLogsForRange } from '../db/habitDB';

export default function PageTwo() {
  const [habits, setHabits] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('positive');
  const [expandedHabitId, setExpandedHabitId] = useState(null);
  const [habitStatsById, setHabitStatsById] = useState({});
  const [habitLogsById, setHabitLogsById] = useState({});

  useEffect(() => {
    loadHabits();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHabits();
    }, [])
  );

  const loadHabits = async () => {
    try {
      const data = await getHabits();
      setHabits(data);
    } catch (error) {
      console.error('Failed to load habits:', error);
    }
  };

  const handleAddHabit = async () => {
    if (!newHabitName.trim()) {
      Alert.alert('Error', 'Please enter a habit name');
      return;
    }

    try {
      await addHabit(newHabitName.trim(), newHabitType);
      setNewHabitName('');
      setNewHabitType('positive');
      setModalVisible(false);
      await loadHabits();
    } catch (error) {
      console.error('Failed to add habit:', error);
      Alert.alert('Error', 'Failed to add habit');
    }
  };

  const handleDeleteHabit = async (habitId) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit? All associated data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit(habitId);
              await loadHabits();
              if (expandedHabitId === habitId) {
                setExpandedHabitId(null);
              }
              setHabitStatsById((prev) => {
                const next = { ...prev };
                delete next[habitId];
                return next;
              });
            } catch (error) {
              console.error('Failed to delete habit:', error);
              Alert.alert('Error', 'Failed to delete habit');
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (habitId) => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => handleDeleteHabit(habitId)}
    >
      <Ionicons name="trash" size={24} color="#333" />
    </Pressable>
  );

  const handleToggleHabit = async (habit) => {
    if (expandedHabitId === habit.id) {
      setExpandedHabitId(null);
      return;
    }

    setExpandedHabitId(habit.id);
    try {
      let stats = await getHabitStats(habit.id, 10);
      
      // For negative habits, exclude today's date
      if (habit.type === 'negative') {
        const today = new Date().toISOString().split('T')[0];
        stats = stats.filter(stat => stat.log_date !== today);
      }
      
      setHabitStatsById((prev) => ({
        ...prev,
        [habit.id]: stats,
      }));

      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startDate = formatDateKey(rangeStart);
      const endDate = formatDateKey(rangeEnd);
      const logs = await getHabitLogsForRange(habit.id, startDate, endDate);

      setHabitLogsById((prev) => ({
        ...prev,
        [habit.id]: logs,
      }));
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const calculateStreak = (stats) => {
    let streak = 0;
    for (const stat of stats) {
      if (stat.completed === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const calculateSuccessRate = (stats) => {
    if (stats.length === 0) return 0;
    const completed = stats.filter(s => s.completed === 1).length;
    return Math.round((completed / stats.length) * 100);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    return `${day} ${month}`;
  };

  const formatDateKey = (date) => {
    const pad2 = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  };

  const getMonthMatrix = (year, monthIndex) => {
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();

    const weeks = [];
    let currentDay = 1 - startDay;
    while (currentDay <= daysInMonth) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        if (currentDay < 1 || currentDay > daysInMonth) {
          week.push(null);
        } else {
          week.push(currentDay);
        }
        currentDay++;
      }
      weeks.push(week);
    }
    return weeks;
  };

  const renderStatistics = (habit, stats, logs) => {
    const streak = calculateStreak(stats);
    const successRate = calculateSuccessRate(stats);

    const logsMap = logs.reduce((acc, log) => {
      acc[log.log_date] = log.completed === 1;
      return acc;
    }, {});

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const previousMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);

    const currentMonthWeeks = getMonthMatrix(currentYear, currentMonthIndex);
    const previousMonthWeeks = getMonthMatrix(previousMonthDate.getFullYear(), previousMonthDate.getMonth());

    const habitStartDate = logs.length > 0 ? logs[0].log_date : (habit.created_at ? formatDateKey(new Date(habit.created_at)) : null);
    const todayKey = formatDateKey(now);

    const getDayStatus = (year, monthIndex, day) => {
      const dateKey = formatDateKey(new Date(year, monthIndex, day));

      if (habitStartDate && dateKey < habitStartDate) {
        return '—';
      }

      if (habit.type === 'negative' && dateKey === todayKey) {
        return '';
      }

      if (dateKey > todayKey) {
        return '';
      }

      if (dateKey in logsMap) {
        return logsMap[dateKey] ? '✓' : '✕';
      }

      return '—';
    };

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsCards}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={24} color="#FF9500" />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={24} color="#34C759" />
            <Text style={styles.statValue}>{successRate}%</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={24} color="#007AFF" />
            <Text style={styles.statValue}>{stats.length}</Text>
            <Text style={styles.statLabel}>Days Logged</Text>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Calendar</Text>
          <View style={styles.calendarSection}>
            <Text style={styles.calendarTitle}>
              {previousMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.weekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekdayCell}>{day}</Text>
              ))}
            </View>
            {previousMonthWeeks.map((week, index) => (
              <View key={index} style={styles.weekRow}>
                {week.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.dayCell}>
                    {day ? (
                      <>
                        <Text style={styles.dayNumber}>{day}</Text>
                        <Text style={styles.dayStatus}>
                          {getDayStatus(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), day)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.calendarSection}>
            <Text style={styles.calendarTitle}>
              {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.weekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekdayCell}>{day}</Text>
              ))}
            </View>
            {currentMonthWeeks.map((week, index) => (
              <View key={index} style={styles.weekRow}>
                {week.map((day, dayIndex) => (
                  <View key={dayIndex} style={styles.dayCell}>
                    {day ? (
                      <>
                        <Text style={styles.dayNumber}>{day}</Text>
                        <Text style={styles.dayStatus}>
                          {getDayStatus(currentYear, currentMonthIndex, day)}
                        </Text>
                      </>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderHabitItem = (habit) => {
    const isExpanded = expandedHabitId === habit.id;
    const stats = habitStatsById[habit.id] || [];
    const logs = habitLogsById[habit.id] || [];

    return (
      <Swipeable
        key={habit.id}
        renderRightActions={() => renderRightActions(habit.id)}
      >
        <View
          style={[
            styles.habitItem,
            habit.type === 'positive' ? styles.positiveHabit : styles.negativeHabit,
            isExpanded && styles.habitItemExpanded,
          ]}
        >
          <Pressable
            style={styles.habitHeader}
            onPress={() => handleToggleHabit(habit)}
          >
            <View style={styles.habitHeaderLeft}>
              <Ionicons
                name={habit.type === 'positive' ? 'trending-up' : 'trending-down'}
                size={20}
                color={habit.type === 'positive' ? '#34C759' : '#FF3B30'}
              />
              <Text style={styles.habitItemName}>{habit.name}</Text>
            </View>
            <View style={styles.habitHeaderRight}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#666"
              />
            </View>
          </Pressable>

          {isExpanded && (
            <View style={styles.habitBody}>
              {renderStatistics(habit, stats, logs)}
            </View>
          )}
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Track Habits</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle" size={32} color="#007AFF" />
          </Pressable>
        </View>

        <ScrollView style={styles.habitsList} contentContainerStyle={styles.habitsListContent}>
          {habits.map(renderHabitItem)}
          {habits.length === 0 && (
            <Text style={styles.noHabits}>No habits yet. Add one to get started!</Text>
          )}
        </ScrollView>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Habit</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </Pressable>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Habit name"
              placeholderTextColor="#999"
              value={newHabitName}
              onChangeText={setNewHabitName}
              maxLength={50}
            />

            <View style={styles.typeSelector}>
              <Pressable
                style={[
                  styles.typeButton,
                  styles.positiveTypeButton,
                  newHabitType === 'positive' && styles.typeButtonSelected,
                ]}
                onPress={() => setNewHabitType('positive')}
              >
                <Ionicons name="trending-up" size={20} color="#34C759" />
                <Text style={styles.typeButtonText}>Positive Habit</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.typeButton,
                  styles.negativeTypeButton,
                  newHabitType === 'negative' && styles.typeButtonSelected,
                ]}
                onPress={() => setNewHabitType('negative')}
              >
                <Ionicons name="trending-down" size={20} color="#FF3B30" />
                <Text style={styles.typeButtonText}>Negative Habit</Text>
              </Pressable>
            </View>

            <Pressable style={styles.submitButton} onPress={handleAddHabit}>
              <Text style={styles.submitButtonText}>Add Habit</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  addButton: {
    padding: 4,
  },
  habitsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  habitsListContent: {
    paddingBottom: 24,
  },
  habitItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  positiveHabit: {
    borderLeftColor: '#34C759',
  },
  negativeHabit: {
    borderLeftColor: '#FF3B30',
  },
  habitItemExpanded: {
    backgroundColor: '#fdfdfd',
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  habitHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  habitHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  habitItemName: {
    fontSize: 15,
    marginLeft: 8,
    color: '#000',
    flex: 1,
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  habitBody: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noHabits: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flex: 1,
    paddingTop: 16,
  },
  statsCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 8,
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  historySection: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  calendarSection: {
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#888',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 6,
  },
  dayNumber: {
    fontSize: 11,
    color: '#444',
  },
  dayStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  typeSelector: {
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#eee',
  },
  positiveTypeButton: {
    borderColor: '#34C759',
  },
  negativeTypeButton: {
    borderColor: '#FF3B30',
  },
  typeButtonSelected: {
    backgroundColor: '#f0f9f4',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
    color: '#000',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
