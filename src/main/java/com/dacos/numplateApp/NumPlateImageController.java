package com.dacos.numplateApp;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.BusinessException;

/** 기존 번호판 JSP와 React가 함께 사용하는 image.do 호환 엔드포인트다. */
@RestController
public class NumPlateImageController {

    private final NumPlateService numPlateService;

    public NumPlateImageController(NumPlateService numPlateService) {
        this.numPlateService = numPlateService;
    }

    @GetMapping("/image.do")
    public ResponseEntity<byte[]> image(
            @RequestParam("key") String serviceId,
            @RequestParam(value = "img", defaultValue = "1") int slot) {
        try {
            byte[] image = numPlateService.getCompatibleProcessImage(serviceId, slot);
            MediaType type = image.length > 4 && image[0] == (byte) 0x89 && image[1] == 0x50
                    ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).body(image);
        } catch (BusinessException exception) {
            if (exception.getStatusCode() != 404) throw exception;
            return ResponseEntity.status(HttpStatus.FOUND)
                    .cacheControl(CacheControl.noStore())
                    .location(numPlateService.legacyImageUri(serviceId, slot))
                    .build();
        }
    }
}
