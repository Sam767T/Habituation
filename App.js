import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Focus from './screens/Focus';
import PageOne from './screens/PageOne';
import PageTwo from './screens/PageTwo';


const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Log') {
                iconName = focused ? 'checkbox' : 'checkbox-outline';
              } else if (route.name === 'Track') {
                iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              } else if (route.name === 'Focus') {
                iconName = focused ? 'time' : 'time-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#999',
          })}
        >
          <Tab.Screen name="Log" component={PageOne} />
          <Tab.Screen name="Track" component={PageTwo} />
          <Tab.Screen name="Focus" component={Focus} />
        </Tab.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({});
