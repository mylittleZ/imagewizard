/* eslint-disable camelcase */
import { clerkClient } from "@clerk/nextjs/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions";

// 定义 Clerk 用户数据接口
interface ClerkUser {
  id: string;
  email_addresses: { email_address: string }[];
  image_url: string;
  first_name: string;
  last_name: string;
  username: string;
}

export async function POST(req: Request) {
  // 从环境变量获取 Webhook Secret
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // 获取请求头
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // 如果请求头缺失，返回错误
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // 获取请求体
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // 创建 Svix 实例
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // 验证请求体和头信息
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // 获取事件 ID 和类型
  const { id } = evt.data;
  const eventType = evt.type;

  // 处理 user.created 事件
  if (eventType === "user.created") {
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

    // 设置公共元数据
    if (newUser) {
      await clerkClient.users.updateUserMetadata(userData.id, {
        publicMetadata: {
          userId: newUser._id,
        },
      });
    }

    return NextResponse.json({ message: "OK", user: newUser });
  }

  // 处理 user.updated 事件
  if (eventType === "user.updated") {
    const userData = evt.data as ClerkUser;

    const user = {
      firstName: userData.first_name ?? "",
      lastName: userData.last_name ?? "",
      username: userData.username ?? "",
      photo: userData.image_url ?? "",
    };

    const updatedUser = await updateUser(userData.id, user);

    return NextResponse.json({ message: "OK", user: updatedUser });
  }

  // 处理 user.deleted 事件
  if (eventType === "user.deleted") {
    const userId = evt.data.id;

    const deletedUser = await deleteUser(userId!);

    return NextResponse.json({ message: "OK", user: deletedUser });
  }

  console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  return new Response("", { status: 200 });
}
