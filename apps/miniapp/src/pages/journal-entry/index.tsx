import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useState } from "react";

import {
  deleteJournalEntry,
  findJournalEntry,
  saveJournalEntry,
  type LocalJournalEntry,
} from "@/entities/journal";
import { copy } from "@/shared/copy";
import { confirm, toast } from "@/shared/lib/feedback";
import { formatDateTime } from "@/shared/lib/format";
import { readQueryValue } from "@/shared/lib/navigation";
import { useSession } from "@/shared/session";
import {
  Button,
  Screen,
  Sheet,
  TextAreaField,
  TextField,
} from "@/shared/ui";

import "./index.scss";

export default function JournalEntryPage() {
  const router = useRouter();
  const session = useSession();
  const entryId = readQueryValue(router.params.id);

  const [entry, setEntry] = useState<LocalJournalEntry | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const userId = session.user?.id ?? "";

  useEffect(() => {
    if (!userId || !entryId) return;
    const found = findJournalEntry(userId, entryId);
    setEntry(found);
    if (found) {
      setTitle(found.title);
      setBody(found.body);
      void Taro.setNavigationBarTitle({ title: found.title });
    }
  }, [userId, entryId]);

  if (session.status !== "ready") {
    return (
      <Screen
        status={session.status === "error" ? "error" : "loading"}
        errorTitle={copy.app.signInFailed}
        onRetry={session.retry}
      />
    );
  }

  if (!entry) {
    return <Screen status="error" errorTitle={copy.journal.notFound} />;
  }

  function save(): void {
    const trimmed = title.trim();
    if (!trimmed || !entry) return;
    const saved = saveJournalEntry(userId, {
      id: entry.id,
      title: trimmed,
      body,
      tripId: entry.tripId,
    });
    setEntry(saved);
    setEditorOpen(false);
    toast(copy.app.saved);
  }

  async function remove(): Promise<void> {
    if (!entry) return;
    if (!(await confirm(copy.journal.deleteConfirm))) return;
    deleteJournalEntry(userId, entry.id);
    void Taro.navigateBack();
  }

  return (
    <Screen>
      <Text className="ot-entry__title">{entry.title}</Text>
      <Text className="ot-entry__date">{formatDateTime(entry.occurredAt)}</Text>
      {entry.body ? (
        <Text className="ot-entry__body">{entry.body}</Text>
      ) : null}

      <View className="ot-entry__actions">
        <Button variant="secondary" block onClick={() => setEditorOpen(true)}>
          {copy.app.edit}
        </Button>
        <Button variant="danger" block onClick={() => void remove()}>
          {copy.app.delete}
        </Button>
      </View>

      <Sheet
        open={editorOpen}
        title={copy.app.edit}
        onClose={() => setEditorOpen(false)}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setEditorOpen(false)}>
              {copy.app.cancel}
            </Button>
            <Button block disabled={!title.trim()} onClick={save}>
              {copy.app.save}
            </Button>
          </>
        }
      >
        <TextField
          label={copy.journal.fieldTitle}
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
