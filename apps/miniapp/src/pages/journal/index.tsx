import { Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useCallback, useEffect, useState } from "react";

import {
  readJournalEntries,
  saveJournalEntry,
  type LocalJournalEntry,
} from "@/entities/journal";
import { copy } from "@/shared/copy";
import { toast } from "@/shared/lib/feedback";
import { formatDateTime } from "@/shared/lib/format";
import {
  openJournalEntry,
  takeJournalComposeRequest,
} from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import {
  Button,
  EmptyState,
  Screen,
  Sheet,
  TextAreaField,
  TextField,
  Tag,
} from "@/shared/ui";

import "./index.scss";

export default function JournalPage() {
  const session = useSession();
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const reload = useCallback(() => {
    if (!session.user) return;
    setEntries(readJournalEntries(session.user.id));
    if (takeJournalComposeRequest()) setComposerOpen(true);
  }, [session.user]);

  // Entries live in device storage, so the list is re-read whenever the page
  // becomes visible again rather than cached by React Query.
  useDidShow(reload);

  // Cold start: useDidShow fires before the session resolves, so reload again
  // once the user lands (reload is keyed on session.user).
  useEffect(() => {
    reload();
  }, [reload]);

  if (session.status !== "ready" || !session.user) {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  const userId = session.user.id;

  function submit(): void {
    // The title is optional (web parity): untitled entries get a display name.
    const trimmed = title.trim();
    saveJournalEntry(userId, {
      title: trimmed || copy.journal.untitled,
      body,
      tripId: null,
    });
    setTitle("");
    setBody("");
    setComposerOpen(false);
    setEntries(readJournalEntries(userId));
    toast(copy.app.saved);
  }

  return (
    <Screen tab>
      <View className="ot-journal__masthead">
        <View className="ot-journal__heading">
          <Text className="ot-journal__title">{copy.journal.title}</Text>
          <Text className="ot-journal__subtitle">{copy.journal.subtitle}</Text>
        </View>
        <View className="ot-journal__masthead-actions">
          <Tag label={copy.journal.localOnly} />
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            {copy.journal.compose}
          </Button>
        </View>
      </View>

      {entries.length === 0 ? (
        <EmptyState
          title={copy.journal.empty}
          hint={copy.journal.emptyHint}
          action={
            <Button onClick={() => setComposerOpen(true)}>
              {copy.journal.emptyCta}
            </Button>
          }
        />
      ) : (
        <View className="ot-journal__list">
          {entries.map((entry) => (
            <View
              className="ot-journal__entry"
              key={entry.id}
              hoverClass="ot-journal__entry--pressed"
              hoverStartTime={0}
              hoverStayTime={80}
              onClick={() => openJournalEntry(entry.id)}
            >
              <Text className="ot-journal__entry-title">{entry.title}</Text>
              <Text className="ot-journal__entry-date">
                {formatDateTime(entry.occurredAt)}
              </Text>
              {entry.body ? (
                <Text className="ot-journal__entry-excerpt">{entry.body}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Sheet
        open={composerOpen}
        title={copy.journal.compose}
        onClose={() => setComposerOpen(false)}
        clearTabBar
        footer={
          <>
            <Button
              variant="secondary"
              block
              onClick={() => setComposerOpen(false)}
            >
              {copy.app.cancel}
            </Button>
            <Button block onClick={submit}>
              {copy.app.save}
            </Button>
          </>
        }
      >
        <TextField
          label={copy.journal.titlePlaceholder}
          value={title}
          onChange={setTitle}
        />
        <TextAreaField
          label={copy.journal.fieldBody}
          value={body}
          onChange={setBody}
        />
      </Sheet>
    </Screen>
  );
}
