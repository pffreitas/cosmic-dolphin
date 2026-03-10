import { Profile } from "../types";
import { ProfileRepository } from "../repositories/profile.repository";

export interface ProfileService {
  findById(id: string): Promise<Profile | null>;
  upsert(
    id: string,
    data: { name?: string; email?: string; pictureUrl?: string }
  ): Promise<Profile>;
  update(
    id: string,
    data: Partial<Pick<Profile, "name" | "email" | "pictureUrl">>
  ): Promise<Profile>;
}

export class ProfileServiceImpl implements ProfileService {
  constructor(private profileRepository: ProfileRepository) {}

  async findById(id: string): Promise<Profile | null> {
    const profile = await this.profileRepository.findById(id);
    return profile ? this.mapDatabaseToProfile(profile) : null;
  }

  async upsert(
    id: string,
    data: { name?: string; email?: string; pictureUrl?: string }
  ): Promise<Profile> {
    const profile = await this.profileRepository.upsert(id, {
      name: data.name,
      email: data.email,
      picture_url: data.pictureUrl,
    });
    return this.mapDatabaseToProfile(profile);
  }

  async update(
    id: string,
    data: Partial<Pick<Profile, "name" | "email" | "pictureUrl">>
  ): Promise<Profile> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.pictureUrl !== undefined) updateData.picture_url = data.pictureUrl;

    const profile = await this.profileRepository.update(id, updateData);
    return this.mapDatabaseToProfile(profile);
  }

  private mapDatabaseToProfile(data: Record<string, unknown>): Profile {
    return {
      id: data.id as string,
      name: (data.name as string) || undefined,
      email: (data.email as string) || undefined,
      pictureUrl: (data.picture_url as string) || undefined,
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}
