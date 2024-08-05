import { clerkClient as createClerkClient } from "@clerk/nextjs/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions";

const clerkClient = createClerkClient();

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string }[];
  image_url: string;
  first_name: string;
  last_name: string;
  username: string;
}

export async function POST(req: Request) {
  console.log("POST request received");

  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("Webhook secret is missing");
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  const headerPayload = headers();
  console.log("Headers received:", headerPayload);

  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  console.log("svix-id:", svix_id);
  console.log("svix-timestamp:", svix_timestamp);
  console.log("svix-signature:", svix_signature);

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  const payload = await req.json();
  console.log("Payload received:", payload);

  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
    console.log("Webhook event verified:", evt);
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;
  console.log(`Webhook with ID: ${id} and type: ${eventType}`);
  console.log("Webhook body:", body);

  try {
    if (eventType === "user.created") {
      console.log("Handling user.created event");
      const userData = evt.data as ClerkUser;

      const user = {
        clerkId: userData.id,
        email: userData.email_addresses[0]?.email_address ?? "",
        username: userData.username ?? "",
        firstName: userData.first_name ?? "",
        lastName: userData.last_name ?? "",
        photo: userData.image_url ?? "",
      };

      if (!user.clerkId || !user.email || !user.username) {
        console.error("Invalid user data", user);
        return new Response("Invalid user data", { status: 400 });
      }

      const newUser = await createUser(user);
      console.log("User created:", newUser);

      if (newUser) {
        await clerkClient.users.updateUserMetadata(userData.id, {
          publicMetadata: {
            userId: newUser._id,
          },
        });
      }

      return new Response(
        JSON.stringify({ message: "User created", user: newUser }),
        { status: 200 }
      );
    }

    if (eventType === "user.updated") {
      console.log("Handling user.updated event");
      const userData = evt.data as ClerkUser;

      const user = {
        firstName: userData.first_name ?? "",
        lastName: userData.last_name ?? "",
        username: userData.username ?? "",
        photo: userData.image_url ?? "",
      };

      const updatedUser = await updateUser(userData.id, user);
      console.log("User updated:", updatedUser);

      return new Response(
        JSON.stringify({ message: "User updated", user: updatedUser }),
        { status: 200 }
      );
    }

    if (eventType === "user.deleted") {
      console.log("Handling user.deleted event");
      const userId = evt.data.id;

      if (userId) {
        const deletedUser = await deleteUser(userId);
        console.log("User deleted:", deletedUser);
        return new Response(
          JSON.stringify({ message: "User deleted", user: deletedUser }),
          { status: 200 }
        );
      } else {
        console.error("userId is undefined");
        return new Response("Invalid user ID", { status: 400 });
      }
    }

    console.log(`Unhandled event with ID: ${id} and type: ${eventType}`);
    return new Response("Unhandled event type", { status: 200 });
  } catch (error) {
    console.error("Error handling event:", error);
    return new Response("Error occured while handling event", {
      status: 500,
    });
  }
}
