import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { useState, type ReactNode } from "react";

import "./Field.scss";

interface FieldShellProps {
  /** Omitted where surrounding copy already names the input, e.g. a composer. */
  label?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldShellProps) {
  return (
    <View className="ot-field">
      {label ? <Text className="ot-field__label">{label}</Text> : null}
      {children}
      {hint ? <Text className="ot-field__hint">{hint}</Text> : null}
    </View>
  );
}

interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** "nickname" enables the WeChat nickname suggestion bar above the keyboard. */
  type?: "text" | "number" | "digit" | "nickname";
  hint?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: TextFieldProps) {
  // WXSS inputs cannot be styled on :focus, so the ring is class-driven.
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <Input
        className={focused ? "ot-field__input is-focused" : "ot-field__input"}
        value={value}
        type={type}
        placeholder={placeholder}
        placeholderClass="ot-field__placeholder"
        onInput={(event) => onChange(String(event.detail.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Field>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: TextAreaFieldProps) {
  return (
    <Field label={label}>
      <Textarea
        className="ot-field__textarea"
        value={value}
        placeholder={placeholder}
        placeholderClass="ot-field__placeholder"
        maxlength={-1}
        autoHeight
        onInput={(event) => onChange(String(event.detail.value))}
      />
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  labelFor: (option: T) => string;
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  labelFor,
  onChange,
}: SelectFieldProps<T>) {
  const range = options.map(labelFor);
  const selected = Math.max(0, options.indexOf(value));
  return (
    <Field label={label}>
      <Picker
        mode="selector"
        range={range}
        value={selected}
        onChange={(event) => {
          const next = options[Number(event.detail.value)];
          if (next) onChange(next);
        }}
      >
        <View className="ot-field__picker">
          <Text>{labelFor(value)}</Text>
        </View>
      </Picker>
    </Field>
  );
}

interface DateFieldProps {
  label: string;
  /** ISO `YYYY-MM-DD`, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder,
}: DateFieldProps) {
  return (
    <Field label={label}>
      <Picker
        mode="date"
        value={value}
        onChange={(event) => onChange(String(event.detail.value))}
      >
        <View className="ot-field__picker">
          <Text className={value ? "" : "ot-field__placeholder-text"}>
            {value || placeholder || label}
          </Text>
        </View>
      </Picker>
    </Field>
  );
}

interface TimeFieldProps {
  label: string;
  /** `HH:mm`, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  return (
    <Field label={label}>
      <Picker
        mode="time"
        value={value}
        onChange={(event) => onChange(String(event.detail.value))}
      >
        <View className="ot-field__picker">
          <Text className={value ? "" : "ot-field__placeholder-text"}>
            {value || "--:--"}
          </Text>
        </View>
      </Picker>
    </Field>
  );
}
