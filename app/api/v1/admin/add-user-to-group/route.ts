// app/api/admin/add-user-to-group/route.ts
import { client } from '@/src/lib/amplifyClient.server';

export async function POST(req: Request) {
  const { userId, groupName } = await req.json();

  const result = await client.mutations.addUserToGroup({
    userId,
    groupName,
  });

  return Response.json(result);
}
