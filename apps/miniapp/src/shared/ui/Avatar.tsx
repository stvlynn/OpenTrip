import { Image, Text, View } from "@tarojs/components";

import "./Avatar.scss";

export interface AvatarPerson {
  initials: string;
  avatarBg: string;
  avatarFg: string;
  image?: string | null;
}

interface AvatarProps {
  person: AvatarPerson;
  size?: "sm" | "md";
}

export function Avatar({ person, size = "sm" }: AvatarProps) {
  return (
    <View
      className={`ot-avatar ot-avatar--${size}`}
      style={{ background: person.avatarBg, color: person.avatarFg }}
    >
      {person.image ? (
        <Image className="ot-avatar__image" src={person.image} mode="aspectFill" />
      ) : (
        <Text className="ot-avatar__initials">{person.initials}</Text>
      )}
    </View>
  );
}

interface AvatarStackProps {
  people: readonly AvatarPerson[];
  max?: number;
}

export function AvatarStack({ people, max = 4 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <View className="ot-avatar-stack">
      {shown.map((person, index) => (
        <View className="ot-avatar-stack__slot" key={`${person.initials}-${index}`}>
          <Avatar person={person} />
        </View>
      ))}
      {overflow > 0 ? (
        <View className="ot-avatar-stack__slot">
          <View className="ot-avatar ot-avatar--sm ot-avatar--overflow">
            <Text className="ot-avatar__initials">+{overflow}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
