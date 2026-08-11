const AVATAR_PHOTO_IDS = [
  '1494790108377-be9c29b29330',
  '1507003211169-0a1dd7228f2d',
  '1438761681033-6461ffad8d80',
  '1500648767791-00dcc994a43e',
  '1534528741775-53994a69daeb',
  '1506794778202-cad84cf45f1d',
  '1544005313-94ddf0286df2',
  '1519085360753-af0119f7cbe7',
  '1517841905240-472988babdf9',
  '1531123897727-8f129e1688ce',
];

export function unsplashUrl(photoId: string, width = 600): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

/** Deterministically picks a portrait-ish stock photo for a seed string, mirroring the source design's avatar hashing. */
export function avatarPhotoUrl(seed: string, width = 200): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return unsplashUrl(AVATAR_PHOTO_IDS[hash % AVATAR_PHOTO_IDS.length], width);
}
