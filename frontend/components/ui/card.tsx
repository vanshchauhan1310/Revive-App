// src/components/ui/card.tsx
import React from "react";
import { View, Text, ViewStyle, TextStyle } from "react-native";

interface CardProps {
  style?: ViewStyle;
  children?: React.ReactNode;
}

interface CardTextProps {
  style?: TextStyle;
  children?: React.ReactNode;
}

const Card = React.forwardRef<
  React.ElementRef<typeof View>,
  CardProps
>(({ style, ...props }, ref) => (
  <View
    ref={ref}
    style={[
      {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3, // For Android shadow
      },
      style
    ]}
    {...props}
  />
));

const CardHeader = React.forwardRef<
  React.ElementRef<typeof View>,
  CardProps
>(({ style, ...props }, ref) => (
  <View
    ref={ref}
    style={[
      {
        flexDirection: 'column',
        gap: 6, // Space between items (React Native 0.71+)
        padding: 24,
      },
      style
    ]}
    {...props}
  />
));

const CardTitle = React.forwardRef<
  React.ElementRef<typeof Text>,
  CardTextProps
>(({ style, ...props }, ref) => (
  <Text
    ref={ref}
    style={[
      {
        fontSize: 28,
        fontWeight: '600',
        lineHeight: 32,
        letterSpacing: -0.025,
        color: '#111827',
      },
      style
    ]}
    {...props}
  />
));

const CardDescription = React.forwardRef<
  React.ElementRef<typeof Text>,
  CardTextProps
>(({ style, ...props }, ref) => (
  <Text
    ref={ref}
    style={[
      {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
      },
      style
    ]}
    {...props}
  />
));

const CardContent = React.forwardRef<
  React.ElementRef<typeof View>,
  CardProps
>(({ style, ...props }, ref) => (
  <View 
    ref={ref} 
    style={[
      { 
        padding: 24, 
        paddingTop: 0 
      },
      style
    ]} 
    {...props} 
  />
));

const CardFooter = React.forwardRef<
  React.ElementRef<typeof View>,
  CardProps
>(({ style, ...props }, ref) => (
  <View
    ref={ref}
    style={[
      {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
        paddingTop: 0,
      },
      style
    ]}
    {...props}
  />
));

Card.displayName = "Card";
CardHeader.displayName = "CardHeader";
CardTitle.displayName = "CardTitle";
CardDescription.displayName = "CardDescription";
CardContent.displayName = "CardContent";
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};