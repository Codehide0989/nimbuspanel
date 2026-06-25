"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { acceptInvitation } from "@/actions/invitations";

interface Props {
  token: string;
}

export function AcceptInviteClient({ token }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleAccept = async () => {
    setStatus("loading");
    const result = await acceptInvitation(token);
    if (result.error) {
      setStatus("error");
      setErrorMessage(result.error);
    } else {
      setStatus("success");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-strong rounded-xl p-8 text-center">
        <div className="text-2xl mb-2">⚡</div>
        <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-success bg-clip-text text-transparent mb-6">
          NimbusPanel
        </h1>

        {status === "idle" && (
          <>
            <h2 className="text-base font-semibold text-foreground mb-2">Accept Invitation</h2>
            <p className="text-sm text-muted mb-6">
              You have been invited to join a workspace. Click below to accept.
            </p>
            <button
              onClick={handleAccept}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Accept & Join
            </button>
          </>
        )}

        {status === "loading" && (
          <div className="py-8">
            <Loader2 size={24} className="animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted">Processing invitation...</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8">
            <CheckCircle size={32} className="text-success mx-auto mb-3" />
            <h2 className="text-base font-semibold text-foreground mb-1">Welcome!</h2>
            <p className="text-sm text-muted">Redirecting to dashboard...</p>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <AlertCircle size={32} className="text-danger mx-auto mb-3" />
            <h2 className="text-base font-semibold text-foreground mb-1">Invalid Invitation</h2>
            <p className="text-sm text-muted">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
