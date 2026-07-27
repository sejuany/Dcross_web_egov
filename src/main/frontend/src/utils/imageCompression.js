import imageCompression from 'browser-image-compression';

/**
 * 이미지 압축
 * - 이미지가 아닌 파일(PDF 등)은 그대로 반환
 * - 최대 2MB, 최대 해상도 2500px로 압축
 *
 * @param {File} file 업로드 파일
 * @returns {Promise<File>} 압축된 파일
 */
export const compressImage = async (file) => {

    // 이미지가 아니면 그대로 반환
    if (!file?.type?.startsWith('image/')) {
        return file;
    }

    const options = {
        maxSizeMB: 2,               // 최대 용량
        maxWidthOrHeight: 2500,     // 최대 해상도
        initialQuality: 0.9,        // 초기 품질
        useWebWorker: true          // WebWorker 사용
    };

    try {

		const compressedBlob = await imageCompression(file, options);

		const compressedFile = new File(
		    [compressedBlob],
		    file.name,
		    {
		        type: compressedBlob.type,
		        lastModified: Date.now(),
		    }
		);

		console.log(
		    `[ImageCompression] ${file.name} : ` +
		    `${(file.size / 1024 / 1024).toFixed(2)}MB → ` +
		    `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
		);

		return compressedFile;

    } catch (e) {

        console.error('[ImageCompression] 이미지 압축 실패', e);

        // 실패 시 원본 업로드
        return file;
    }
};