import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PageOne() {
  return (
    <View style={styles.container}>
      <Text>Welcome to Page One</Text>
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
