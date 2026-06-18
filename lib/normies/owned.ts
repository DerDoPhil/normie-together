import { NORMIES_NFT } from "./addresses";

/**
 * Build the Alchemy NFT API base from the configured RPC URL.
 * ETH_RPC_URL looks like https://eth-mainnet.g.alchemy.com/v2/<KEY>;
 * the NFT API lives at https://eth-mainnet.g.alchemy.com/nft/v3/<KEY>.
 */
function alchemyNftBase(): string | null {
  const rpc = process.env.ETH_RPC_URL ?? process.env.NEXT_PUBLIC_ETH_RPC_URL;
  if (!rpc) return null;
  const m = rpc.match(/^(https:\/\/[^/]+)\/v2\/([^/?]+)/);
  if (!m) return null;
  const [, host, key] = m;
  return `${host}/nft/v3/${key}`;
}

interface OwnedNftsResponse {
  ownedNfts?: { tokenId?: string }[];
  pageKey?: string;
}

/**
 * Token IDs of the Normies collection held by `address`, via Alchemy.
 * Returns [] if the NFT API is unavailable.
 */
export async function getOwnedNormies(address: string): Promise<bigint[]> {
  const base = alchemyNftBase();
  if (!base) return [];

  const ids: bigint[] = [];
  let pageKey: string | undefined;

  // Follow pagination up to a few pages (whales aside, owners hold a handful).
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${base}/getNFTsForOwner`);
    url.searchParams.set("owner", address);
    url.searchParams.append("contractAddresses[]", NORMIES_NFT);
    url.searchParams.set("withMetadata", "false");
    url.searchParams.set("pageSize", "100");
    if (pageKey) url.searchParams.set("pageKey", pageKey);

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) break;
    const data = (await res.json()) as OwnedNftsResponse;
    for (const nft of data.ownedNfts ?? []) {
      if (nft.tokenId !== undefined) {
        try {
          ids.push(BigInt(nft.tokenId));
        } catch {
          /* skip malformed id */
        }
      }
    }
    if (!data.pageKey) break;
    pageKey = data.pageKey;
  }

  return ids;
}
