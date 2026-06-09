import org.jasypt.encryption.pbe.StandardPBEStringEncryptor;

public class JasyptTest {
    public static void main(String[] args) {
        StandardPBEStringEncryptor encryptor = new StandardPBEStringEncryptor();
        // [중요] 암호화/복호화에 사용할 '마스터 키'를 정합니다. (절대 외부에 노출되면 안 됨)
        encryptor.setPassword("DacosSecretKey!@#"); 
        encryptor.setAlgorithm("PBEWithMD5AndDES"); // 암호화 알고리즘

        // 암호화할 내용을 여기에 넣고 돌려보세요
        String encryptedUrl = encryptor.encrypt("jdbc:oracle:thin:@10.109.111.150:1309/oscar");
        String encryptedUsername = encryptor.encrypt("dacos309");
        String encryptedPassword = encryptor.encrypt("daCos0907");

        System.out.println("ENC(" + encryptedUrl + ")");
        System.out.println("ENC(" + encryptedUsername + ")");
        System.out.println("ENC(" + encryptedPassword + ")");
    }
}