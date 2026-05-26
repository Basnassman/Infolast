import crypto from "crypto";

const algorithm =
  "aes-256-gcm";

const secret =
  process.env
    .APP_SECRET ||
  "change_me";

export const encryptionService =
  {
    encrypt(
      value: string
    ): string {
      const iv =
        crypto.randomBytes(
          16
        );

      const key =
        crypto
          .createHash(
            "sha256"
          )
          .update(secret)
          .digest();

      const cipher =
        crypto.createCipheriv(
          algorithm,
          key,
          iv
        );

      const encrypted =
        Buffer.concat([
          cipher.update(
            value,
            "utf8"
          ),

          cipher.final(),
        ]);

      const tag =
        cipher.getAuthTag();

      return [
        iv.toString(
          "hex"
        ),

        tag.toString(
          "hex"
        ),

        encrypted.toString(
          "hex"
        ),
      ].join(":");
    },

    decrypt(
      payload: string
    ): string {
      const [
        ivHex,
        tagHex,
        encryptedHex,
      ] =
        payload.split(":");

      const key =
        crypto
          .createHash(
            "sha256"
          )
          .update(secret)
          .digest();

      const decipher =
        crypto.createDecipheriv(
          algorithm,
          key,
          Buffer.from(
            ivHex,
            "hex"
          )
        );

      decipher.setAuthTag(
        Buffer.from(
          tagHex,
          "hex"
        )
      );

      const decrypted =
        Buffer.concat([
          decipher.update(
            Buffer.from(
              encryptedHex,
              "hex"
            )
          ),

          decipher.final(),
        ]);

      return decrypted.toString(
        "utf8"
      );
    },
  };