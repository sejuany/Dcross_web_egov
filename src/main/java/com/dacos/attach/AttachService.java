package com.dacos.attach;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

import com.dacos.attach.mapper.AttachMapper;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;
import com.dacos.customer.CustomerService;


/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@Service
public class AttachService {

    private static final Logger logger = LoggerFactory.getLogger(AttachService.class);
    // DB 저장 경로
    private static final String WA_ATTACH_PATH_NM = "/upload";
    private static final long WA_ATTACH_MAX_SIZE = 10L * 1024L * 1024L;
    
    private final AttachMapper attachMapper;
    private final CustomerService customerService;
    
    public AttachService(AttachMapper attachMapper, CustomerService customerService) {
        this.attachMapper = attachMapper;
        this.customerService = customerService;
    }

	/**
	 * 첨부파일 목록 조회
	 */
	public List<Map<String, Object>> getAttachFiles(String serviceId, String token, UserDto user) {
		
		serviceId = resolveServiceId(serviceId, token, user);
		
	    String cleanServiceId = Objects.toString(serviceId, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", cleanServiceId);

	    List<Map<String, Object>> list = attachMapper.getAttachFiles(param);
	    
	    String prefix = cleanServiceId + "_";


	    for (Map<String, Object> file : list) {

	        // 파일 URL
	    	file.put("FILE_URL", buildAttachFileUrl(file, token));

	        // 서버 저장 파일명
	        // {서비스아이디}_{파일코드}.{확장자}
	        // 예) N010-260710-43600_OWNER_ID.jpg
	        String serverFileName = Objects.toString(file.get("ATCHSVRFILE_NM"), "");

	        String code = "";

	        if (serverFileName.startsWith(prefix)) {

	            code = serverFileName.substring(prefix.length());

	            int dotIndex = code.lastIndexOf('.');

	            if (dotIndex > -1) {
	                code = code.substring(0, dotIndex);
	            }
	        }

	        file.put("CODE", code);
	    }

	    return list;
	}
    
	/**
	 * 서버 IP 또는 Host명 조회
	 */
	public String getServerAddress(String sGubun) {
		InetAddress ip = null;
		try {
		  ip = InetAddress.getLocalHost();
		} catch (UnknownHostException e) {
		  e.printStackTrace();
		}
		return ("IP".equals(sGubun) ? ip.getHostAddress() : ip.getHostName());
	}
    
	/**
	 * 첨부파일 저장 루트 경로 조회
	 */
	private String getAttachUploadRoot() {

	    String serverIp = getServerAddress("IP");

	    // 운영 WAS2
	    if ("10.109.111.40".equals(serverIp)) {
	        return "/web/upload";
	    }
	    
	    logger.info("serverIp = {}", serverIp);
	    
        // 로컬
        if ("127.0.0.1".equals(serverIp)
        		|| "169.254.242.223".equals(serverIp)
                || "localhost".equalsIgnoreCase(serverIp)) {
        	return "C:\\Users\\다코스\\Downloads\\uploadTest";
        }

	    // 개발
	    return "D:\\webapps\\DaCOS\\upload";
	}

	/**
	 * 첨부파일 전체 경로 생성
	 */
	public Path getAttachFilePath(String fileName) {
	    return Paths.get(getAttachUploadRoot())
	            .resolve(fileName)
	            .normalize();
	}

	/**
	 * 첨부파일 업로드 및 DB 저장
	 */
	@Transactional
	public List<Map<String, Object>> uploadAttachFile(
	        String serviceId, String code, String gubun,
	        MultipartFile file, UserDto user, String token
	) {
		
	    // 관리자면 serviceId 사용
	    // 고객이면 token으로 SERVICE_ID 조회
	    serviceId = resolveServiceId(serviceId, token, user);

	    String cleanServiceId = Objects.toString(serviceId, "").trim();
	    String cleanCode = Objects.toString(code, "").trim();
	    String cleanGubun = Objects.toString(gubun, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    if (cleanCode.isBlank()) {
	        throw new BusinessException("첨부파일 코드가 없습니다.", 400);
	    }

	    if (cleanGubun.isBlank()) {
	        throw new BusinessException("첨부파일 구분값이 없습니다.", 400);
	    }

	    if (file == null || file.isEmpty()) {
	        throw new BusinessException("첨부파일이 없습니다.", 400);
	    }

	    if (file.getSize() > WA_ATTACH_MAX_SIZE) {
	        throw new BusinessException("첨부파일은 10MB 이하만 가능합니다.", 400);
	    }
	    
	    try {
			 // ============================
			 // 기존 첨부파일 삭제
			 // ============================
			 Path uploadDir = Paths.get(getAttachUploadRoot());
			 Files.createDirectories(uploadDir);
		
			 deleteOldAttachFiles(
			         uploadDir, cleanServiceId, cleanCode, cleanGubun
			 );
			 
			 // ============================
			 // SEQ 결정
			 // 삭제 후 현재 첨부파일 개수를 다음 SEQ로 사용
			 // ============================
			 List<Map<String, Object>> attachList =
			         getAttachFiles(cleanServiceId, token, user);
		
			 int seq = attachList.stream()
				        .map(m -> Objects.toString(m.get("SEQ"), ""))
				        .filter(s -> !s.isBlank())
				        .mapToInt(Integer::parseInt)
				        .max()
				        .orElse(-1) + 1;
		
			 logger.info("seq={}", seq);
		
			 String originalFileName = sanitizeOriginalFileName(file.getOriginalFilename());
			 String extension = getFileExtension(originalFileName);
		
			 // {서비스아이디}_{첨부파일코드}.{확장자}
			 String savedFileName =
			         cleanServiceId + "_" + cleanCode + extension;

	    
	        Path savePath = uploadDir.resolve(savedFileName).normalize();

	        logger.info("[WA 첨부 업로드] serviceId={}, code={}, gubun={}, seq={}",
	                cleanServiceId, cleanCode, cleanGubun, seq);

	        logger.info("[WA 첨부 업로드] originalName={}", originalFileName);
	        logger.info("[WA 첨부 업로드] contentType={}", file.getContentType());
	        logger.info("[WA 첨부 업로드] fileSize={}", file.getSize());
	        logger.info("[WA 첨부 업로드] savePath={}", savePath);

	        // 업로드
	        file.transferTo(savePath.toFile());

	        logger.info("[WA 첨부 업로드] savedFileSize={}", Files.size(savePath));

		    // 고객페이지에서 업로드 하는 경우
			String loginId = user != null
			        ? Objects.toString(user.getLOGIN_ID(), "")
			        : "CUSTOMER";

		    Map<String, Object> param = new HashMap<>();

		    param.put("SERVICE_ID", cleanServiceId);
		    param.put("SEQ", String.valueOf(seq));
		    param.put("ATCHFILE_NM", originalFileName);
		    param.put("ATCHSVRFILE_NM", savedFileName);
		    param.put("ATCHFILEPATH_NM", WA_ATTACH_PATH_NM);
		    param.put("GUBUN", cleanGubun);
		    param.put("INS_USER", loginId);
		    param.put("UPD_USER", loginId);

		    attachMapper.insertAttachFile(param);
	    } catch (IOException e) {

	        logger.error("[NewcarService] WA 신규등록 첨부파일 저장 실패", e);

	        throw new BusinessException("첨부파일 저장 중 오류가 발생했습니다.", 500);
	    }

	    return getAttachFiles(cleanServiceId, token, user);
	}
	
	
	/**
	 * 기존 첨부파일 삭제 ( 저장할 때 사용 ) 
	 * - DB : 같은 SERVICE_ID + GUBUN + CODE(확장자 무관)
	 * - 파일 : 같은 SERVICE_ID_CODE(확장자 무관)
	 */
	private void deleteOldAttachFiles(
	        Path uploadDir,
	        String serviceId,
	        String code,
	        String gubun) {

	    String prefix = serviceId + "_" + code;

	    // ===== DB 삭제 =====
	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    param.put("GUBUN", gubun);

	    List<Map<String, Object>> attachList =
	            attachMapper.getAttachFiles(param);

	    for (Map<String, Object> row : attachList) {

	        String serverFileName =
	                Objects.toString(row.get("ATCHSVRFILE_NM"), "");

	        if (!serverFileName.startsWith(prefix)) {
	            continue;
	        }

	        Map<String, Object> deleteParam = new HashMap<>();
	        deleteParam.put("SERVICE_ID", row.get("SERVICE_ID"));
	        deleteParam.put("GUBUN", row.get("GUBUN"));
	        deleteParam.put("SEQ", row.get("SEQ"));

	        attachMapper.deleteAttachFile(deleteParam);
	    }

	    // ===== 서버 파일 삭제 =====
	    try (Stream<Path> stream = Files.list(uploadDir)) {

	        stream.filter(Files::isRegularFile)
	              .filter(path ->
	                      path.getFileName().toString().startsWith(prefix))
	              .forEach(path -> {
	                  try {
	                      Files.deleteIfExists(path);
	                  } catch (IOException e) {
	                      throw new UncheckedIOException(e);
	                  }
	              });

	    } catch (IOException e) {
	        throw new BusinessException("기존 첨부파일 삭제 중 오류가 발생했습니다.", 500);
	    }
	}
	
	/**
	 * 첨부파일 정보 단건 조회
	 */
	public Map<String, Object> getAttachFile(
	        String serviceId,
	        String token,
	        String fileName,
	        UserDto user) {

	    serviceId = resolveServiceId(serviceId, token, user);

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    param.put("ATCHSVRFILE_NM", fileName);

	    List<Map<String, Object>> list =
	    		attachMapper.getAttachFiles(param);

	    if (list.isEmpty()) {
	        return null;
	    }

	    return list.get(0);
	}
	
	/**
	 * 첨부파일 다운로드(단건 조회)
	 * - 관리자 : serviceId 기반 조회
	 * - 고객 : token 기반으로 SERVICE_ID 조회 후 첨부파일 반환
	 */
	public ResponseEntity<Resource> viewWaAttachFile(
	        String serviceId,
	        String token,
	        String fileName,
	        UserDto user) throws IOException {

	    // 관리자(serviceId) 또는 고객(token) 기준으로 SERVICE_ID 조회
	    serviceId = resolveServiceId(serviceId, token, user);

	    String cleanServiceId = Objects.toString(serviceId, "").trim();

	    if (cleanServiceId.isBlank()) {
	        throw new BusinessException("접수번호가 없습니다.", 400);
	    }

	    // SERVICE_ID + 서버 파일명으로 첨부파일 조회
	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", cleanServiceId);
	    param.put("ATCHSVRFILE_NM", fileName);

	    List<Map<String, Object>> list =
	    		attachMapper.getAttachFiles(param);

	    if (list.isEmpty()) {
	        throw new BusinessException("파일이 존재하지 않습니다.", 404);
	    }

	    Map<String, Object> fileInfo = list.get(0);

	    // 실제 저장된 파일 경로 조회
	    String serverFileName = Objects.toString(fileInfo.get("ATCHSVRFILE_NM"), "");
	    Path path = getAttachFilePath(serverFileName);

	    if (!Files.exists(path) || !Files.isRegularFile(path)) {
	        throw new BusinessException("파일이 존재하지 않습니다.", 404);
	    }

	    // 파일 Resource 생성
	    Resource resource = new UrlResource(path.toUri());

	    // 원본 파일명
	    String originalName = Objects.toString(fileInfo.get("ATCHFILE_NM"), "");

	    // MIME 타입 자동 판별
	    String contentType = Files.probeContentType(path);

	    if (contentType == null || contentType.isBlank()) {
	        contentType = "application/octet-stream";
	    }

	    // 브라우저에서 바로 표시(inline)하도록 응답
	    return ResponseEntity.ok()
	            .contentType(MediaType.parseMediaType(contentType))
	            .header(
	                    HttpHeaders.CONTENT_DISPOSITION,
	                    ContentDisposition.inline()
	                            .filename(originalName, StandardCharsets.UTF_8)
	                            .build()
	                            .toString()
	            )
	            .body(resource);
	}

	/**
	 * 원본 파일명 정리
	 */
    private String sanitizeOriginalFileName(String fileName) {

        String value = Objects.toString(fileName, "").trim();

        if (value.isBlank()) {
            return "attach_file";
        }

        value = value.replace("\\", "/");

        int lastSlashIndex = value.lastIndexOf("/");
        if (lastSlashIndex >= 0) {
            value = value.substring(lastSlashIndex + 1);
        }

        return value.replaceAll("[\\r\\n]", "");
    }

    /**
     * 파일 확장자 추출
     */
    private String getFileExtension(String fileName) {

        String value = Objects.toString(fileName, "").trim();
        int dotIndex = value.lastIndexOf(".");

        if (dotIndex < 0) {
            return "";
        }

        return value.substring(dotIndex).toLowerCase();
    }

    /**
     * 첨부파일 조회 URL 생성
     */
    private String buildAttachFileUrl(
            Map<String, Object> file,
            String token) {

        String savedFileName = Objects.toString(file.get("ATCHSVRFILE_NM"), "").trim();

        if (savedFileName.isBlank()) {
            return "";
        }

        String encodedFileName = URLEncoder
                .encode(savedFileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        // 고객페이지
        if (token != null && !token.isBlank()) {
            return "/api/customer/file/view?token="
                    + URLEncoder.encode(token, StandardCharsets.UTF_8)
                    + "&fileName="
                    + encodedFileName;
        }

        // 관리자(WA)
        return "/api/newcar/wa-attach-view?fileName=" + encodedFileName;
    }

	/**
	 * 사용자 유형에 따른 SERVICE_ID 조회
	 */
    private String resolveServiceId(
            String serviceId,
            String token,
            UserDto user) {

        // 로그인 사용자
        if (user != null) {
            return serviceId;
        }

        // 고객페이지는 TOKEN으로 SERVICE_ID 조회
        Map<String, Object> param = new HashMap<>();
        param.put("TOKEN", token);
        		
        // 고객페이지
        Map<String, Object> info = customerService.getTokenInfo(param);

        if (info == null) {
            throw new BusinessException("유효하지 않은 링크입니다.");
        }

        return Objects.toString(info.get("SERVICE_ID"));
    }

    
    /* *******************************************************************
     * - PDF 생성
     * *******************************************************************/
	@Transactional
	public void mergePdf(String serviceId) {
	
	    // 1. 병합 대상 조회
	    List<Map<String, Object>> attachList = getMergeAttachFiles(serviceId);
	
	    // 2. 병합할 실제 파일 조회
	    List<Path> mergeFiles = getMergeFiles(attachList);
	
	    // 3. PDF 생성
	    Path pdfPath = createMergePdf(serviceId, mergeFiles);
	
	    // 4. 서버 저장 및 DB 저장
	    saveMergePdf(serviceId, pdfPath);
	}
	
	/*
	 * 1. 병합 대상 조회
	 */
	private List<Map<String, Object>> getMergeAttachFiles(String serviceId) {

	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    param.put("GUBUN", "MERGE");

	    List<Map<String, Object>> attachList =
	            attachMapper.getAttachFiles(param);

	    logger.info("merge attach count={}", attachList.size());

	    if (attachList.isEmpty()) {
	        throw new BusinessException("병합할 첨부파일이 없습니다.", 400);
	    }

	    return attachList;
	}
	
	/*
	 * 2. 실제 파일 조회
	 */
	private List<Path> getMergeFiles(List<Map<String, Object>> attachList) {

	    List<Path> mergeFiles = new ArrayList<>();

	    Path uploadRoot = Paths.get(getAttachUploadRoot());

	    for (Map<String, Object> row : attachList) {

	        String serverFileName =
	                Objects.toString(row.get("ATCHSVRFILE_NM"), "");

	        Path filePath = uploadRoot.resolve(serverFileName);

	        if (!Files.exists(filePath)) {
	            logger.warn("파일 없음 : {}", filePath);
	            continue;
	        }

	        mergeFiles.add(filePath);
	    }

	    if (mergeFiles.isEmpty()) {
	        throw new BusinessException("병합할 이미지가 없습니다.", 400);
	    }

	    return mergeFiles;
	}
	
	/*
	 * 3. PDF 생성
	 */
	private Path createMergePdf(
	        String serviceId,
	        List<Path> mergeFiles) {

	    Path uploadRoot = Paths.get(getAttachUploadRoot());
	    Path pdfPath = uploadRoot.resolve(serviceId + "_MERGE.pdf");
	    
	    try (PDDocument document = new PDDocument()) {
		    
	    	// 1. 기존 PDF 삭제
		    Files.deleteIfExists(pdfPath);

	        for (Path imagePath : mergeFiles) {

	            BufferedImage bufferedImage = ImageIO.read(imagePath.toFile());

	            if (bufferedImage == null) {
	                throw new BusinessException(
	                        "이미지 파일을 읽을 수 없습니다. : " + imagePath.getFileName()
	                        , 500);
	            }

	            PDPage page = new PDPage(
	                    new PDRectangle(
	                            bufferedImage.getWidth(),
	                            bufferedImage.getHeight()
	                    )
	            );

	            document.addPage(page);

	            PDImageXObject pdImage = JPEGFactory.createFromImage(
	                    document,
	                    bufferedImage
	            );

	            try (PDPageContentStream contentStream =
	                         new PDPageContentStream(document, page)) {

	                contentStream.drawImage(
	                        pdImage,
	                        0,
	                        0,
	                        bufferedImage.getWidth(),
	                        bufferedImage.getHeight()
	                );
	            }
	        }

	        document.save(pdfPath.toFile());

	        logger.info("[PDF 병합] 생성 완료 : {}", pdfPath);

	        return pdfPath;

	    } catch (Exception e) {

	        logger.error("[PDF 병합] 생성 실패", e);

	        throw new BusinessException("병합 PDF 생성 중 오류가 발생했습니다.", 500);
	    }
	}
	
	
	/*
	 * DB 저장
	 */
	private void saveMergePdf(
	        String serviceId,
	        Path pdfPath) {

	    // 기존 병합 PDF 삭제
	    Map<String, Object> deleteParam = new HashMap<>();
	    deleteParam.put("SERVICE_ID", serviceId);
	    deleteParam.put("GUBUN", "NWEB");
	    deleteParam.put("ATCHSVRFILE_NM", serviceId + "_MERGE.pdf");

	    attachMapper.deleteAttachFile(deleteParam);

	    // NWEB 마지막 SEQ 조회
	    Map<String, Object> selectParam = new HashMap<>();
	    selectParam.put("SERVICE_ID", serviceId);
	    selectParam.put("GUBUN", "NWEB");

	    List<Map<String, Object>> attachList =
	            attachMapper.getAttachFiles(selectParam);

	    int seq = attachList.stream()
	            .map(m -> Objects.toString(m.get("SEQ"), ""))
	            .filter(s -> !s.isBlank())
	            .mapToInt(Integer::parseInt)
	            .max()
	            .orElse(-1) + 1;

	    String loginId = "SYSTEM";

	    Map<String, Object> insertParam = new HashMap<>();
	    insertParam.put("SERVICE_ID", serviceId);
	    insertParam.put("SEQ", String.valueOf(seq));
	    insertParam.put("ATCHFILE_NM", "MERGE.pdf");
	    insertParam.put("ATCHSVRFILE_NM", pdfPath.getFileName().toString());
	    insertParam.put("ATCHFILEPATH_NM", WA_ATTACH_PATH_NM);
	    insertParam.put("GUBUN", "NWEB");
	    insertParam.put("INS_USER", loginId);
	    insertParam.put("UPD_USER", loginId);

	    attachMapper.insertAttachFile(insertParam);

	    logger.info("[PDF 병합] DB 저장 완료 : {}", pdfPath.getFileName());
	}
}



