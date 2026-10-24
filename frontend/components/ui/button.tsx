// src/components/ui/button.tsx
import React from "react";
import { 
  TouchableOpacity, 
  Text, 
  ViewStyle, 
  TextStyle, 
  TouchableOpacityProps,
  ActivityIndicator 
} from "react-native";

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
}

const buttonVariants: Record<string, ViewStyle> = {
  default: {
    backgroundColor: '#111827',
    borderRadius: 6,
  },
  destructive: {
    backgroundColor: '#dc2626',
    borderRadius: 6,
  },
  outline: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
    borderRadius: 6,
  },
  secondary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: 6,
  },
  link: {
    backgroundColor: 'transparent',
  },
};

const buttonSizes: Record<string, ViewStyle> = {
  default: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  lg: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  icon: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
};

const textVariants: Record<string, TextStyle> = {
  default: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  destructive: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  outline: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  secondary: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  ghost: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
};

const textSizes: Record<string, TextStyle> = {
  default: {
    fontSize: 14,
  },
  sm: {
    fontSize: 12,
  },
  lg: {
    fontSize: 16,
  },
  icon: {
    fontSize: 14,
  },
};

const Button = React.forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  ButtonProps
>(({ 
  variant = 'default', 
  size = 'default', 
  style, 
  textStyle, 
  children, 
  disabled, 
  loading,
  ...props 
}, ref) => {
  const buttonStyle = [
    {
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    } as ViewStyle,
    buttonVariants[variant],
    buttonSizes[size],
    disabled && { opacity: 0.5 },
    loading && { opacity: 0.7 },
    style,
  ];

  const buttonTextStyle = [
    textVariants[variant],
    textSizes[size],
    textStyle,
  ];

  return (
    <TouchableOpacity
      ref={ref}
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading && (
        <ActivityIndicator 
          size="small" 
          color={variant === 'default' || variant === 'destructive' ? '#ffffff' : '#111827'}
          style={{ marginRight: children ? 8 : 0 }}
        />
      )}
      {typeof children === 'string' ? (
        <Text style={buttonTextStyle}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
});

Button.displayName = "Button";

export { Button, type ButtonProps };