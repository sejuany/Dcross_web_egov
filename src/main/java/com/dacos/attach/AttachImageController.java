package com.dacos.attach;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            @RequestParam(defaultValue = "011") String workCd,
            @RequestParam(defaultValue = "") String carNo,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "false") boolean missingReturnPlate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.ok(service.list(
                AuthUtil.getLoginUser(session), workCd, carNo, startDate, endDate, missingReturnPlate, page, size)));
    }

    @GetMapping("/{serviceId}/{slot}")
    public ResponseEntity<byte[]> image(@PathVariable String serviceId, @PathVariable int slot, HttpSession session) {
        byte[] image = service.image(AuthUtil.getLoginUser(session), serviceId, slot);
        MediaType type = image.length > 4 && image[0] == (byte) 0x89 && image[1] == 0x50
                ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).body(image);
    }
}
