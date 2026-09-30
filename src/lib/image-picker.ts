/**
 * src/lib/image-picker.ts
 *
 * Centralized image picker and manipulation utility.
 * Consolidates permissions, selection, square cropping, resizing,
 * compression, and byte/base64 length checks across profile and posts.
 *
 * Grounded in Expo SDK 57:
 * - expo-image-picker: ~57.0.17
 * - expo-image-manipulator: ~57.0.17
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { ImageLimits } from '../constants/limits.ts';

// ============================================================================
// Types & Error Handling
// ============================================================================

export interface ProcessedImage {
  uri: string;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export type ImagePickerErrorCode =
  | 'PERMISSION_DENIED'
  | 'LIMIT_REACHED'
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'CANCELLED'
  | 'UNKNOWN';

export class ImagePickerError extends Error {
  constructor(
    message: string,
    public readonly code: ImagePickerErrorCode
  ) {
    super(message);
    this.name = 'ImagePickerError';
  }
}

export interface PickAndProcessImageOptions {
  /** If true, crops the image to a centered 1:1 square. Default: false */
  cropSquare?: boolean;
  /** Target width & height for square cropping in pixels. Default: 512 */
  targetDimension?: number;
  /** Image picker launch quality (0.0 to 1.0). Default: 0.85 */
  pickerQuality?: number;
  /** Compression quality when saving via ImageManipulator (0.0 to 1.0). Default: 0.8 */
  manipulatorCompress?: number;
  /** Max base64 string length allowed. Default: 2,796,200 chars (~2 MB) */
  maxBase64Chars?: number;
  /** Save format for manipulated image. Default: SaveFormat.JPEG */
  format?: SaveFormat;
  /** Whether to explicitly verify media library permissions. Default: false */
  requestPermission?: boolean;
}

export interface PickMultipleImagesOptions {
  /** Maximum number of photos allowed in total. Default: 5 */
  limit?: number;
  /** Current count of already attached photos. Default: 0 */
  currentCount?: number;
  /** Whether to explicitly request media library permission on native. Default: true */
  requestPermission?: boolean;
  /** Image picker launch quality (0.0 to 1.0). Default: 0.85 */
  quality?: number;
  /** Maximum base64 length per photo (optional). */
  maxBase64CharsPerPhoto?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Verifies or requests photo library permissions on native platforms.
 * Web always returns true as modern browsers manage picker permissions natively.
 */
export async function requestPhotoLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return permission.granted;
  } catch {
    return false;
  }
}

/**
 * Pure image manipulation pipeline:
 * Performs centered square cropping, resizing to targetDimension, and JPEG/PNG re-encoding.
 */
export async function cropAndResizeSquare(
  uri: string,
  width: number,
  height: number,
  targetDimension: number = ImageLimits.maxProfileAvatarDimensionPx,
  compress: number = ImageLimits.avatarCompression,
  format: SaveFormat = SaveFormat.JPEG
): Promise<{ uri: string; base64: string; width: number; height: number }> {
  if (width < 1 || height < 1) {
    throw new ImagePickerError('Invalid image dimensions', 'INVALID_IMAGE');
  }

  const side = Math.min(width, height);
  const originX = Math.round((width - side) / 2);
  const originY = Math.round((height - side) / 2);

  const context = ImageManipulator.manipulate(uri);
  context
    .crop({ originX, originY, width: side, height: side })
    .resize({ width: targetDimension, height: targetDimension });

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format, compress, base64: true });

  if (!saved.base64) {
    throw new ImagePickerError('Failed to encode image to base64', 'INVALID_IMAGE');
  }

  return {
    uri: saved.uri,
    base64: saved.base64,
    width: saved.width,
    height: saved.height,
  };
}

// ============================================================================
// Public APIs
// ============================================================================

/**
 * Fulfills PROJECT.md interface contract:
 * Launches the system picker for a single image, optionally crops to a centered square,
 * resizes, compresses, verifies size limits, and returns a normalized ProcessedImage.
 */
export async function pickAndProcessImage(
  options?: PickAndProcessImageOptions
): Promise<ProcessedImage | null> {
  const {
    cropSquare = false,
    targetDimension = ImageLimits.maxProfileAvatarDimensionPx,
    pickerQuality = ImageLimits.avatarQuality,
    manipulatorCompress = ImageLimits.avatarCompression,
    maxBase64Chars = ImageLimits.maxAvatarBase64Chars,
    format = SaveFormat.JPEG,
    requestPermission = false,
  } = options ?? {};

  if (requestPermission) {
    const granted = await requestPhotoLibraryPermission();
    if (!granted) {
      throw new ImagePickerError('Photo library access was denied.', 'PERMISSION_DENIED');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: cropSquare,
    aspect: cropSquare ? [1, 1] : undefined,
    quality: pickerQuality,
    base64: !cropSquare,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset || (asset.width != null && asset.width < 1) || (asset.height != null && asset.height < 1)) {
    throw new ImagePickerError('Invalid image asset received from picker.', 'INVALID_IMAGE');
  }

  if (cropSquare) {
    const assetWidth = asset.width ?? targetDimension;
    const assetHeight = asset.height ?? targetDimension;

    const manipulated = await cropAndResizeSquare(
      asset.uri,
      assetWidth,
      assetHeight,
      targetDimension,
      manipulatorCompress,
      format
    );

    if (maxBase64Chars && manipulated.base64.length > maxBase64Chars) {
      throw new ImagePickerError('Selected image exceeds the maximum allowed size.', 'IMAGE_TOO_LARGE');
    }

    return {
      uri: manipulated.uri,
      base64: manipulated.base64,
      mimeType: format === SaveFormat.PNG ? 'image/png' : 'image/jpeg',
      width: manipulated.width,
      height: manipulated.height,
    };
  }

  if (!asset.base64) {
    throw new ImagePickerError('ImagePicker did not return base64 payload.', 'INVALID_IMAGE');
  }

  if (maxBase64Chars && asset.base64.length > maxBase64Chars) {
    throw new ImagePickerError('Selected image exceeds the maximum allowed size.', 'IMAGE_TOO_LARGE');
  }

  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Dedicated avatar picker helper.
 * Enforces centered square cropping to 512x512 with 2 MB base64 limit.
 */
export function pickAvatarImage(
  options?: Omit<PickAndProcessImageOptions, 'cropSquare'>
): Promise<ProcessedImage | null> {
  return pickAndProcessImage({ ...options, cropSquare: true });
}

/**
 * Multi-photo picker helper for post creation.
 * Enforces photo limit constraints, checks permissions, and returns an array of ProcessedImages.
 */
export async function pickMultipleImages(
  options?: PickMultipleImagesOptions
): Promise<ProcessedImage[]> {
  const {
    limit = ImageLimits.maxPostPhotos,
    currentCount = 0,
    requestPermission = true,
    quality = ImageLimits.postPhotoQuality,
    maxBase64CharsPerPhoto,
  } = options ?? {};

  const availableSlots = limit - currentCount;
  if (availableSlots <= 0) {
    throw new ImagePickerError(`You can add up to ${limit} photos.`, 'LIMIT_REACHED');
  }

  if (requestPermission) {
    const granted = await requestPhotoLibraryPermission();
    if (!granted) {
      throw new ImagePickerError('Photo access needed to select photos.', 'PERMISSION_DENIED');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: availableSlots,
    base64: true,
    quality,
  });

  if (result.canceled || !result.assets) {
    return [];
  }

  const selected = result.assets.flatMap((asset): ProcessedImage[] => {
    if (!asset.base64) return [];
    if (maxBase64CharsPerPhoto && asset.base64.length > maxBase64CharsPerPhoto) {
      return [];
    }
    return [{
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
    }];
  });

  return selected.slice(0, availableSlots);
}
