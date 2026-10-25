export type BatteryParameter = {
  name: string;
  value: string | number;
  unit?: string;
  valueType: 'battery_const' | 'battery_variable';
  color: string;
  comment?: string;
};
