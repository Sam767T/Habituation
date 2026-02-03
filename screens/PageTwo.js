import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { getHabits, addHabit, deleteHabit, getHabitStats, getHabitLogsForRange } from '../db/habitDB';
import { getStopwatchRecords } from '../db/stopwatchDB';

export default function PageTwo() {
  const [habits, setHabits] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState('positive');
  const [expandedHabitId, setExpandedHabitId] = useState(null);
  const [habitStatsById, setHabitStatsById] = useState({});
  const [habitLogsById, setHabitLogsById] = useState({});
  const [focusActivities, setFocusActivities] = useState([]);
  const [focusDataByName, setFocusDataByName] = useState({});

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
      const records = await getStopwatchRecords();
      const activityMap = new Map();

      records.forEach((record) => {
        const activityName = record.name || 'Unnamed';
        if (!activityMap.has(activityName)) {
          activityMap.set(activityName, []);
        }
        activityMap.get(activityName).push(record);
      });

      const activities = Array.from(activityMap.entries())
        .map(([name, activityRecords]) => ({
          name,
          kind: 'focus',
          records: activityRecords,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setFocusActivities(activities);
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
              if (expandedHabitId === `habit-${habitId}`) {
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

  const getItemKey = (item) => (
    item.kind === 'focus' ? `focus-${item.name}` : `habit-${item.id}`
  );

  const handleToggleHabit = async (item) => {
    const itemKey = getItemKey(item);
    if (expandedHabitId === itemKey) {
      setExpandedHabitId(null);
      return;
    }

    setExpandedHabitId(itemKey);
    try {
      if (item.kind === 'focus') {
        const now = new Date();
        const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startDate = formatDateKey(rangeStart);
        const endDate = formatDateKey(rangeEnd);

        const dailyTotals = {};
        const dailyTotalsAll = {};
        let firstDateKey = null;

        item.records.forEach((record) => {
          const recordDateKey = formatDateKey(new Date(record.created_at));
          if (!firstDateKey || recordDateKey < firstDateKey) {
            firstDateKey = recordDateKey;
          }

          dailyTotalsAll[recordDateKey] = (dailyTotalsAll[recordDateKey] || 0) + record.duration_ms;

          if (recordDateKey >= startDate && recordDateKey <= endDate) {
            dailyTotals[recordDateKey] = (dailyTotals[recordDateKey] || 0) + record.duration_ms;
          }
        });

        const recordMs = Object.values(dailyTotalsAll).reduce(
          (max, value) => (value > max ? value : max),
          0
        );
        const totalMs = Object.values(dailyTotalsAll).reduce(
          (sum, value) => sum + value,
          0
        );

        setFocusDataByName((prev) => ({
          ...prev,
          [item.name]: {
            dailyTotals,
            firstDateKey,
            recordMs,
            totalMs,
          },
        }));

        return;
      }

      let stats = await getHabitStats(item.id, 10);

      // For negative habits, exclude today's date
      if (item.type === 'negative') {
        const today = new Date().toISOString().split('T')[0];
        stats = stats.filter(stat => stat.log_date !== today);
      }

      setHabitStatsById((prev) => ({
        ...prev,
        [item.id]: stats,
      }));

      const now = new Date();
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startDate = formatDateKey(rangeStart);
      const endDate = formatDateKey(rangeEnd);
      const logs = await getHabitLogsForRange(item.id, startDate, endDate);

      setHabitLogsById((prev) => ({
        ...prev,
        [item.id]: logs,
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

  const formatDurationLabel = (ms) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  };

  const calculateFocusStreak = (dailyTotals) => {
    let streak = 0;
    const current = new Date();
    for (let i = 0; i < 366; i++) {
      const key = formatDateKey(current);
      if (dailyTotals[key] && dailyTotals[key] > 0) {
        streak++;
      } else {
        break;
      }
      current.setDate(current.getDate() - 1);
    }
    return streak;
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

  const renderStatistics = (item, stats, logs, focusData) => {
    const isFocus = item.kind === 'focus';
    const logsMap = isFocus
      ? {}
      : logs.reduce((acc, log) => {
        acc[log.log_date] = log.completed === 1;
        return acc;
      }, {});

    const dailyTotals = isFocus ? (focusData?.dailyTotals || {}) : {};
    const recordMs = isFocus ? (focusData?.recordMs || 0) : 0;
    const totalMs = isFocus ? (focusData?.totalMs || 0) : 0;

    const streak = isFocus ? calculateFocusStreak(dailyTotals) : calculateStreak(stats);
    const successRate = isFocus ? 0 : calculateSuccessRate(stats);
    const daysLogged = isFocus
      ? Object.values(dailyTotals).filter((value) => value > 0).length
      : stats.length;
    const totalHours = Math.floor(totalMs / 3600000);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();
    const previousMonthDate = new Date(currentYear, currentMonthIndex - 1, 1);

    const currentMonthWeeks = getMonthMatrix(currentYear, currentMonthIndex);
    const previousMonthWeeks = getMonthMatrix(previousMonthDate.getFullYear(), previousMonthDate.getMonth());

    const habitStartDate = logs.length > 0 ? logs[0].log_date : (item.created_at ? formatDateKey(new Date(item.created_at)) : null);
    const focusStartDate = focusData?.firstDateKey || null;
    const todayKey = formatDateKey(now);

    const getDayStatus = (year, monthIndex, day) => {
      const dateKey = formatDateKey(new Date(year, monthIndex, day));

      if (isFocus) {
        if (focusStartDate && dateKey < focusStartDate) {
          return '—';
        }
        if (dateKey > todayKey) {
          return '';
        }
        const totalMs = dailyTotals[dateKey] || 0;
        if (dateKey === todayKey && totalMs <= 0) {
          return '';
        }
        if (totalMs <= 0) {
          return '✕';
        }
        return formatDurationLabel(totalMs);
      }

      if (habitStartDate && dateKey < habitStartDate) {
        return '—';
      }

      if (item.type === 'negative' && dateKey === todayKey) {
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
            <Text style={styles.statValue}>
              {isFocus ? formatDurationLabel(recordMs) : `${successRate}%`}
            </Text>
            <Text style={styles.statLabel}>
              {isFocus ? 'All-time Record' : 'Success Rate'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={24} color="#007AFF" />
            <Text style={styles.statValue}>{isFocus ? totalHours : daysLogged}</Text>
            <Text style={styles.statLabel}>{isFocus ? 'Total Hours Logged' : 'Days Logged'}</Text>
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

  const renderHabitItem = (item) => {
    const isFocus = item.kind === 'focus';
    const itemKey = getItemKey(item);
    const isExpanded = expandedHabitId === itemKey;
    const stats = isFocus ? [] : (habitStatsById[item.id] || []);
    const logs = isFocus ? [] : (habitLogsById[item.id] || []);
    const focusData = isFocus ? focusDataByName[item.name] : null;

    const content = (
      <View
        style={[
          styles.habitItem,
          isFocus
            ? styles.focusHabit
            : (item.type === 'positive' ? styles.positiveHabit : styles.negativeHabit),
          isExpanded && styles.habitItemExpanded,
        ]}
      >
        <Pressable
          style={styles.habitHeader}
          onPress={() => handleToggleHabit(item)}
        >
          <View style={styles.habitHeaderLeft}>
            <Ionicons
              name={isFocus ? 'time' : (item.type === 'positive' ? 'trending-up' : 'trending-down')}
              size={20}
              color={isFocus ? '#007AFF' : (item.type === 'positive' ? '#34C759' : '#FF3B30')}
            />
            <Text style={styles.habitItemName}>{item.name}</Text>
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
            {renderStatistics(item, stats, logs, focusData)}
          </View>
        )}
      </View>
    );

    if (isFocus) {
      return (
        <View key={itemKey}>
          {content}
        </View>
      );
    }

    return (
      <Swipeable
        key={itemKey}
        renderRightActions={() => renderRightActions(item.id)}
      >
        {content}
      </Swipeable>
    );
  };

  const combinedItems = [
    ...habits.map((habit) => ({ ...habit, kind: 'habit' })),
    ...focusActivities,
  ];

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
          {combinedItems.map(renderHabitItem)}
          {combinedItems.length === 0 && (
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
  focusHabit: {
    borderLeftColor: '#007AFF',
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
    fontSize: 10,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
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
