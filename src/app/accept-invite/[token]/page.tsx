import { acceptInvitation } from "@/actions/invitations";
import { redirect } from "next/navigation";
import { AcceptInviteClient } from "./client";

interface Props {
  params: { token: string };
}

export default function AcceptInvitePage({ params }: Props) {
  return <AcceptInviteClient token={params.token} />;
}
