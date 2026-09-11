export type BackgroundRemovalInput = {
  file: File
}

export type BackgroundRemovalResult = {
  file: File
}

export interface BackgroundRemovalProvider {
  removeBackground(input: BackgroundRemovalInput): Promise<BackgroundRemovalResult>
}