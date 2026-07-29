import { Button as NativeButton, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { updateProfile, uploadAvatar } from "@/shared/api/users";
import { copy } from "@/shared/copy";
import { toast, toastError } from "@/shared/lib/feedback";
import { useSession } from "@/shared/session";
import {
  Avatar,
  Button,
  Screen,
  SectionHeader,
  SelectField,
  Sheet,
  TextField,
} from "@/shared/ui";

import "./index.scss";

const CURRENCIES = ["CNY", "JPY", "USD", "EUR", "HKD", "TWD", "KRW"] as const;
type Currency = (typeof CURRENCIES)[number];

export default function SettingsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(CURRENCIES[0]);
  const [saving, setSaving] = useState(false);

  if (session.status !== "ready" || !session.user) {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  const user = session.user;

  function openEditor(): void {
    setName(user.name);
    setAvatarPath(null);
    const stored = (user.defaultCurrency ?? "") as Currency;
    setCurrency(CURRENCIES.includes(stored) ? stored : CURRENCIES[0]);
    setEditorOpen(true);
  }

  async function save(): Promise<void> {
    setSaving(true);
    try {
      // The upload endpoint updates user.image itself; only then save the rest.
      if (avatarPath) {
        try {
          await uploadAvatar(avatarPath);
        } catch (error) {
          const code = error instanceof Error ? error.message : "";
          toast(
            code === "avatar_too_large"
              ? copy.settings.avatarTooLarge
              : copy.settings.avatarUploadFailed,
          );
          return;
        }
      }
      await updateProfile({ name: name.trim(), defaultCurrency: currency });
      queryClient.clear();
      setEditorOpen(false);
      toast(copy.app.saved);
      session.retry();
    } catch (error) {
      toastError(error, copy.app.loadFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View className="ot-settings__identity">
        <Avatar
          person={{
            initials: initialsOf(user.name),
            // Hex echoes of --corn-100 / --corn-600; Avatar paints inline styles.
            avatarBg: "#dde7fb",
            avatarFg: "#305bb0",
            image: user.image,
          }}
          size="md"
        />
        <View className="ot-settings__identity-text">
          <Text className="ot-settings__name">{user.name}</Text>
          <Text className="ot-settings__meta">
            {user.defaultCurrency || CURRENCIES[0]}
          </Text>
        </View>
        <Button variant="secondary" size="sm" onClick={openEditor}>
          {copy.app.edit}
        </Button>
      </View>

      <SectionHeader title={copy.settings.about} />
      <View className="ot-settings__rows">
        <View className="ot-settings__row">
          <Text className="ot-settings__row-label">{copy.settings.environment}</Text>
          <Text className="ot-settings__row-value">
            {Taro.getAccountInfoSync().miniProgram.envVersion}
          </Text>
        </View>
        <Text className="ot-settings__hint">{copy.settings.webHint}</Text>
      </View>

      <Sheet
        open={editorOpen}
        title={copy.settings.profile}
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setEditorOpen(false)}>
              {copy.app.cancel}
            </Button>
            <Button block disabled={saving || !name.trim()} onClick={() => void save()}>
              {copy.app.save}
            </Button>
          </>
        }
      >
        {/* WeChat avatar/nickname fill capability: chooseAvatar returns a temp
            file uploaded on save; the nickname input offers the WeChat nickname
            above the keyboard. */}
        <View className="ot-field">
          <Text className="ot-field__label">{copy.settings.avatar}</Text>
          <NativeButton
            className="ot-settings__avatar-button"
            openType="chooseAvatar"
            onChooseAvatar={(event) => setAvatarPath(event.detail.avatarUrl)}
          >
            <Avatar
              person={{
                initials: initialsOf(name || user.name),
                avatarBg: "#dde7fb",
                avatarFg: "#305bb0",
                image: avatarPath ?? user.image,
              }}
              size="md"
            />
            <Text className="ot-settings__avatar-hint">
              {copy.settings.avatarHint}
            </Text>
          </NativeButton>
        </View>
        <TextField
          label={copy.settings.name}
          value={name}
          type="nickname"
          onChange={setName}
        />
        <SelectField
          label={copy.settings.currency}
          value={currency}
          options={CURRENCIES}
          labelFor={(option) => option}
          onChange={setCurrency}
        />
      </Sheet>
    </Screen>
  );
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "OT";
  return trimmed.slice(0, 2).toUpperCase();
}
