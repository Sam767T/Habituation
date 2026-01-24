import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Focus from './screens/Focus';
import PageOne from './screens/PageOne';
import PageTwo from './screens/PageTwo';


const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Page One" component={PageOne} />
        <Tab.Screen name="Page Two" component={PageTwo} />
        <Tab.Screen name="Focus" component={Focus} />
      </Tab.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({});
