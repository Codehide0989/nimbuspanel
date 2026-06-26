import { AcceptInviteClient } from "./client";

interface Props {
  params: { token: string };
}

export default function AcceptInvitePage({ params }: Props) {
  return <AcceptInviteClient token={params.token} />;
}
