import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PageTwo() {
  return (
    <View style={styles.container}>
      <Text>This is Page Two</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
