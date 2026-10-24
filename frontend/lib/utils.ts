// src/lib/utils.ts
import { ViewStyle } from "react-native";

type ClassValue = string | ClassArray | ClassDictionary;
interface ClassArray extends Array<ClassValue> {}
interface ClassDictionary extends Record<string, boolean> {}

export function cn(...inputs: ClassValue[]): ViewStyle {
  // This is a simplified version - you'll need to implement
  // proper class merging logic for NativeWind
  return {
    // Add your style processing logic here
  };
}