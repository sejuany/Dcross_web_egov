package com.dacos.attach;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.common.ApiResponse;
import com.dacos.common.util.AuthUtil;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/attach/images")
public class AttachImageController {
    private final AttachImageService service;

    public AttachImageController(AttachImageService service) {
        this.service = service;
    }

    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            String workCd, String carNo, String startDate, String endDate,
            boolean missingReturnPlate, int page, int size, HttpSession session) {
        return list(workCd, carNo, startDate, endDate, missingReturnPlate, false, page, size, session);
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            @RequestParam(defaultValue = "011") String workCd,
            @RequestParam(defaultValue = "") String carNo,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "false") boolean missingReturnPlate,
            @RequestParam(defaultValue = "false") boolean allImages,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(service.list(
                AuthUtil.getLoginUser(session), workCd, carNo, startDate, endDate, missingReturnPlate, allImages, page, size)));
    }

    @GetMapping("/{serviceId}/{slot:[1-6]}")
    public ResponseEntity<byte[]> image(@PathVariable String serviceId, @PathVariable int slot, HttpSession session) {
        return imageResponse(service.image(AuthUtil.getLoginUser(session), serviceId, slot));
    }

    @GetMapping("/{serviceId}/samsong")
    public ResponseEntity<byte[]> samsongImage(@PathVariable String serviceId, HttpSession session) {
        return imageResponse(service.samsongImage(AuthUtil.getLoginUser(session), serviceId));
    }

    @PostMapping(value = "/{serviceId}/{slot:[1-6]}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @PathVariable String serviceId,
            @PathVariable int slot,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean sendDriveReadySms,
            HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(service.upload(
                AuthUtil.getLoginUser(session), serviceId, slot, file, sendDriveReadySms)));
    }

    private static ResponseEntity<byte[]> imageResponse(byte[] image) {
        MediaType type = MediaType.IMAGE_JPEG;
        if (image.length > 4 && image[0] == (byte) 0x89 && image[1] == 0x50) {
            type = MediaType.IMAGE_PNG;
        } else if (image.length > 3 && image[0] == 'G' && image[1] == 'I' && image[2] == 'F') {
            type = MediaType.IMAGE_GIF;
        } else if (image.length > 12 && image[0] == 'R' && image[1] == 'I' && image[8] == 'W' && image[9] == 'E') {
            type = MediaType.parseMediaType("image/webp");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).body(image);
    }
}
