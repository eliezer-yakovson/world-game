/** Per-character colors. The shipped GLBs have no textures and a near-black skin factor. */
export interface CharacterLook {
  skin: number;
  shirt?: number;
  pants?: number;
  hair?: number;
  belt?: number;
  detail?: number;
  hat?: number;
}

const BELT = 0x3a2a22;

export const CHARACTER_LOOKS: Record<string, CharacterLook> = {
  yael: { skin: 0xf2c2a0, shirt: 0x3d6ea8, pants: 0x3a342c, hair: 0x6b3e2a, belt: BELT },
  maya: { skin: 0xf6d3be, shirt: 0xe56b93, pants: 0x5c4578, hair: 0x241714, belt: BELT },
  ori: { skin: 0xe8b892, shirt: 0x3d7a9a, pants: 0x4a4038, hair: 0x3d2a22, belt: BELT },
  tala: { skin: 0xf4c9ae, shirt: 0xe2b143, pants: 0x6e4b32, hair: 0x5a3318, belt: BELT },
  sister: { skin: 0xe7b496, shirt: 0x5c8a7a, pants: 0x39425c, hair: 0x8a3e2a, belt: BELT },
  roni: { skin: 0xd9a57a, shirt: 0x3e7d4f, pants: 0x2c3a55, hair: 0xc4a15a, belt: BELT },
  brother: { skin: 0xf3c7a6, shirt: 0xe07a32, pants: 0x3a4e86, hair: 0xe6c07a, belt: BELT },
  mom: { skin: 0xf0c0a8, shirt: 0xc4537a, pants: 0x3e4c6a, hair: 0x4a2e24, belt: BELT, detail: 0xc4537a },
  dad: { skin: 0xd9a37c, shirt: 0xf4f4f2, pants: 0x5c5344, hair: 0xc8c8c8, belt: 0x6b4228, detail: 0x6b4228 },
  teacher: { skin: 0xf6d0b8, shirt: 0x6e8ca8, pants: 0x4a3b32, hair: 0x6b4428, belt: BELT },
  teacher_david: { skin: 0xd7a67c, shirt: 0xf4f1ea, pants: 0x2c3a4e, hair: 0x3a2a22, belt: BELT, hat: 0x2c3a4e },
  lior: { skin: 0xf0c4a4, shirt: 0x3a7d6e, pants: 0x2e3d55, hair: 0x4a3428, belt: BELT },
  shira: { skin: 0xf8d0b4, shirt: 0x6a4c9a, pants: 0x6a4c9a, hair: 0x2a1a14, belt: BELT },
  eitan: { skin: 0xc98a5c, shirt: 0xd4533a, pants: 0x3a3a3a, hair: 0x1c140f, belt: BELT },
  hila: { skin: 0xf3c8ae, shirt: 0x3aa0c8, pants: 0x3aa0c8, hair: 0x6b3a22, belt: BELT },
  aviv: { skin: 0xe0b08a, shirt: 0xf0f3f6, pants: 0x3d4a62, hair: 0x5a4030, belt: BELT },
  yosef: { skin: 0xc4926a, shirt: 0xe6c15a, pants: 0x3a4a38, hair: 0x2a1c14, belt: BELT },
  rut: { skin: 0xe8b89a, shirt: 0xc46b4a, pants: 0x3e4a38, hair: 0x241610, belt: BELT },
  shopkeeper: { skin: 0xc98b62, shirt: 0xc4473a, pants: 0x3a342e, belt: BELT },
  noam: { skin: 0xe8c09a, shirt: 0x4c6b8a, pants: 0xc2b48a, hair: 0x3a2e28, belt: BELT },
  dani: { skin: 0xc68658, shirt: 0xe6d39a, pants: 0x3d5a86, hat: 0x3d6ea8 },
  neighbor: { skin: 0xe6b89a, shirt: 0x7ba36a, pants: 0x6b5344, hair: 0xc4c0b8, belt: BELT },
  zookeeper: { skin: 0xe0b090, shirt: 0x6fa07a, pants: 0x3e4a3a, hair: 0x3a2418, belt: BELT },
};

export function lookFor(id: string): CharacterLook {
  return CHARACTER_LOOKS[id] ?? { skin: 0xe8b896 };
}
