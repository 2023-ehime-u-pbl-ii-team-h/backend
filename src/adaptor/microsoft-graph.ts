const MICROSOFT_GRAPH_API_ROOT = "https://graph.microsoft.com/v1.0";

export class MicrosoftGraph {
  async getMe(token: string): Promise<{ email: string; name: string } | null> {
    const info = await fetch(MICROSOFT_GRAPH_API_ROOT + "/me", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!info.ok) {
      info.text().then(console.log);
      throw new Error("access failure to `/me` on graph api");
    }

    const { mail, displayName } = (await info.json()) as {
      mail: string;
      displayName: string;
    };
    return { email: mail, name: displayName };
  }
}
