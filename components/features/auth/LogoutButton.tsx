"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LogoutButton({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      queryClient.clear();
      router.push("/login");
      router.refresh();
    } catch {
      queryClient.clear();
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      isLoading={isLoggingOut}
      className={className ? `whitespace-nowrap ${className}` : "whitespace-nowrap"}
    >
      {isLoggingOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
